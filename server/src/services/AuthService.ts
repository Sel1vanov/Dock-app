import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../core/errors.js';
import { RESERVED_NAME_MESSAGE, isReservedName } from '../core/reservedNames.js';
import { createAccessToken, hashPassword, passwordVersion, verifyPassword } from '../core/security.js';
import { NotificationType, type User, UserRole } from '../models/index.js';
import { NotificationRepository, UserRepository } from '../repositories/index.js';
import type { LoginInput, PasswordChangeInput, RegisterInput } from '../schemas/auth.js';
import type { ServiceContext } from './context.js';
import { toUserResponse } from './mappers.js';
import { NotificationService } from './NotificationService.js';

const DUPLICATE_EMAIL = 'Пользователь с таким email уже зарегистрирован';
export const DUPLICATE_PHONE = 'Этот номер телефона уже привязан к другому аккаунту';

// смотрит, какое уникальное ограничение users нарушено, и отдает 409 с нужным полем формы
export function duplicateUserError(e: UniqueConstraintViolationException): ConflictError {
  const constraint = (e as { constraint?: string }).constraint ?? e.message;
  return constraint.includes('uk_users_phone')
    ? new ConflictError(DUPLICATE_PHONE, [{ field: 'phone', message: DUPLICATE_PHONE }])
    : new ConflictError(DUPLICATE_EMAIL, [{ field: 'email', message: DUPLICATE_EMAIL }]);
}

// имя не должно выдавать юзера за сотрудника сервиса (Администратор, Поддержка), см. reservedNames.ts
export function assertNameAllowed(fullName: string): void {
  if (isReservedName(fullName)) {
    throw new ValidationError(RESERVED_NAME_MESSAGE, [{ field: 'fullName', message: RESERVED_NAME_MESSAGE }]);
  }
}

// регистрация, логин, смена пароля и просьба о сбросе
export class AuthService {
  private readonly users: UserRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.users = new UserRepository(ctx.em);
  }

  async register(input: RegisterInput) {
    assertNameAllowed(input.fullName);
    // один email и один телефон - один аккаунт (заблокированный тоже считается, второй не завести)
    // сначала проверяю сам, чтобы отдать понятную ошибку еще до записи
    if (await this.users.existsByEmail(input.email)) {
      throw new ConflictError(DUPLICATE_EMAIL, [{ field: 'email', message: DUPLICATE_EMAIL }]);
    }
    if (await this.users.existsByPhone(input.phone)) {
      throw new ConflictError(DUPLICATE_PHONE, [{ field: 'phone', message: DUPLICATE_PHONE }]);
    }

    const user = this.users.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      fullName: input.fullName,
      phone: input.phone,
    });
    try {
      await this.ctx.em.flush();
    } catch (e) {
      // а уникальные uk_users_email и uk_users_phone в базе страхуют, если зарегистрировались одновременно
      if (e instanceof UniqueConstraintViolationException) throw duplicateUserError(e);
      throw e;
    }
    return { ...this.issueToken(user), user: toUserResponse(user, null) };
  }

  async login(input: LoginInput) {
    const user = await this.users.findByEmailWithPassword(input.email);
    // ответ одинаковый и для "нет такого email", и для "неверный пароль" - чтобы не палить, кто зарегистрирован
    const ok = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !ok) throw new UnauthorizedError('Неверный email или пароль');
    if (user.isBlocked) throw new ForbiddenError('Аккаунт заблокирован администратором');

    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return { ...this.issueToken(user), user: toUserResponse(user, rating) };
  }

  // смена пароля по текущему. старые токены перестают приниматься, взамен выдается новый
  async changePassword(user: User, input: PasswordChangeInput) {
    const withHash = await this.users.findByEmailWithPassword(user.email);
    if (!withHash || !(await verifyPassword(input.currentPassword, withHash.passwordHash))) {
      throw new ValidationError('Неверный текущий пароль', [
        { field: 'currentPassword', message: 'Неверный текущий пароль' },
      ]);
    }
    withHash.passwordHash = await hashPassword(input.newPassword);
    withHash.passwordChangedAt = new Date();
    await this.ctx.em.flush();
    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return { ...this.issueToken(withHash), user: toUserResponse(withHash, rating) };
  }

  // "забыли пароль?": почты в проекте нет, поэтому просьба уходит админам уведомлением,
  // а админ выдает временный пароль и сообщает его по телефону из профиля
  // ответ одинаковый для любого email - не палим, кто зарегистрирован
  async requestPasswordReset(email: string) {
    const user = await this.users.findByEmail(email);
    const notifications = new NotificationRepository(this.ctx.em);
    if (
      user &&
      user.role !== UserRole.Admin &&
      !user.isBlocked &&
      !(await notifications.hasUnreadResetRequest(user.id))
    ) {
      await new NotificationService(this.ctx).notifyAdmins(
        NotificationType.PasswordResetRequested,
        'Просьба сбросить пароль',
        `${user.fullName} (${user.email}, ${user.phone}) не может войти. Выдайте временный пароль и сообщите его по телефону.`,
        { relatedUser: user },
      );
      await this.ctx.em.flush();
    }
    return {
      message:
        'Если такой аккаунт есть, администратор получил просьбу. Он позвонит на номер из профиля и сообщит временный пароль.',
    };
  }

  // тихое продление сессии: по живому токену выдается новый на тот же срок. приложение делает это само,
  // пока им пользуются - так токен живет недолго, а пароль каждый час вводить не надо
  // блокировка и смена пароля уже проверены в authenticate. дольше SESSION_MAX_AGE после ввода пароля не продлеваем
  async refresh(user: User, sessionStartedAt: number) {
    if (Date.now() / 1000 - sessionStartedAt > this.ctx.config.SESSION_MAX_AGE) {
      throw new UnauthorizedError('Сессия длится слишком долго. Войдите снова', 'TOKEN_EXPIRED');
    }
    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return { ...this.issueToken(user, sessionStartedAt), user: toUserResponse(user, rating) };
  }

  private issueToken(user: User, sessionStartedAt?: number) {
    return createAccessToken(
      this.ctx.config,
      { sub: user.id, role: user.role, pwv: passwordVersion(user.passwordChangedAt) },
      sessionStartedAt,
    );
  }
}
