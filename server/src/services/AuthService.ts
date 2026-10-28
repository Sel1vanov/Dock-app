import { UniqueConstraintViolationException } from '@mikro-orm/core';

import { ConflictError, ForbiddenError, UnauthorizedError } from '../core/errors.js';
import { createAccessToken, hashPassword, verifyPassword } from '../core/security.js';
import { UserRepository } from '../repositories/index.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';
import type { ServiceContext } from './context.js';
import { toUserResponse } from './mappers.js';

const DUPLICATE_EMAIL = 'Пользователь с таким email уже зарегистрирован';

/** Регистрация и вход: хеширование пароля, проверка учётных данных, выдача JWT. */
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
    return {
      ...createAccessToken(this.ctx.config, { sub: user.id, role: user.role }),
      user: toUserResponse(user, null),
    };
  }

  async login(input: LoginInput) {
    const user = await this.users.findByEmailWithPassword(input.email);
    // Одинаковый ответ для «нет такого email» и «неверный пароль» — не раскрываем, кто зарегистрирован.
    const ok = await verifyPassword(input.password, user?.passwordHash);
    if (!user || !ok) throw new UnauthorizedError('Неверный email или пароль');
    if (user.isBlocked) throw new ForbiddenError('Аккаунт заблокирован администратором');

    const rating = (await this.users.getRatings([user.id])).get(user.id) ?? null;
    return {
      ...createAccessToken(this.ctx.config, { sub: user.id, role: user.role }),
      user: toUserResponse(user, rating),
    };
  }
}
