import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, UnauthorizedError, ValidationError } from '../core/errors.js';
import { createAccessToken, hashPassword, passwordVersion, verifyPassword } from '../core/security.js';
import { NotificationType, type User, UserRole } from '../models/index.js';
import { NotificationRepository, UserRepository } from '../repositories/index.js';
import type { LoginInput, PasswordChangeInput, RegisterInput } from '../schemas/auth.js';
import type { ServiceContext } from './context.js';
import { toUserResponse } from './mappers.js';
import { NotificationService } from './NotificationService.js';

const DUPLICATE_EMAIL = 'Пользователь с таким email уже зарегистрирован';

/** Регистрация, вход, смена пароля и просьба о его сбросе. */
export class AuthService {
  private readonly users: UserRepository;

  constructor(private readonly ctx: ServiceContext) {
    this.users = new UserRepository(ctx.em);
  }

  async register(input: RegisterInput) {
    // Проверка приложением — понятная ошибка до попытки записи…
    if (await this.users.existsByEmail(input.email)) throw new ConflictError(DUPLICATE_EMAIL);

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
      // …и уникальное ограничение uk_users_email в БД — на случай одновременных регистраций.
      if (e instanceof UniqueConstraintViolationException) throw new ConflictError(DUPLICATE_EMAIL);
      throw e;
    }
    return { ...this.issueToken(user), user: toUserResponse(user, null) };
  }

  async login(input: LoginInput) {
    const user = await this.users.findByEmailWithPassword(input.email);
    // Одинаковый ответ для «нет такого email» и «неверный пароль» — не раскрываем, кто зарегистрирован.
    const ok = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !ok) throw new UnauthorizedError('Неверный email или пароль');
    if (user.isBlocked) throw new ForbiddenError('Аккаунт заблокирован администратором');

    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return { ...this.issueToken(user), user: toUserResponse(user, rating) };
  }

  /** Смена пароля по текущему паролю. Токены, выданные до смены, перестают приниматься; выдаётся новый. */
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

  /**
   * «Забыли пароль?»: почтового сервиса в проекте нет, поэтому просьба уходит администраторам
   * уведомлением, а администратор выдаёт временный пароль и сообщает его по телефону из профиля.
   * Ответ одинаковый для любого email — не раскрываем, кто зарегистрирован.
   */
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

  private issueToken(user: User) {
    return createAccessToken(this.ctx.config, {
      sub: user.id,
      role: user.role,
      pwv: passwordVersion(user.passwordChangedAt),
    });
  }
}
