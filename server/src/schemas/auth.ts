import { z } from 'zod';

import { UserRole } from '../models/enums.js';
import { Phone } from './common.js';
import { UserResponse } from './users.js';

export const Email = z
  .string({ error: 'Укажите email' })
  .trim()
  .toLowerCase()
  .max(254, 'Слишком длинный email')
  .pipe(z.email('Некорректный email'));

export const FullName = z
  .string({ error: 'Укажите имя' })
  .trim()
  .min(2, 'Укажите имя')
  .max(100, 'Не больше 100 символов');

/** bcrypt учитывает только первые 72 байта пароля, поэтому длиннее не принимаем. */
export const Password = z
  .string({ error: 'Укажите пароль' })
  .min(8, 'Пароль: минимум 8 символов')
  .max(72, 'Пароль: не больше 72 символов')
  .regex(/[A-Za-zА-Яа-яЁё]/, 'Пароль должен содержать букву')
  .regex(/[0-9]/, 'Пароль должен содержать цифру');

export const RegisterRequest = z
  .object({
    email: Email,
    password: Password,
    passwordConfirm: z.string({ error: 'Повторите пароль' }),
    fullName: FullName,
    phone: Phone,
    role: z.enum([UserRole.Client, UserRole.Driver], { error: 'Роль: Client или Driver' }),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'Пароли не совпадают' })
  .meta({ id: 'RegisterRequest' });

export const LoginRequest = z
  .object({
    email: Email,
    password: z.string({ error: 'Укажите пароль' }).min(1, 'Укажите пароль').max(72),
  })
  .meta({ id: 'LoginRequest' });

export const PasswordChangeRequest = z
  .object({
    currentPassword: z.string({ error: 'Укажите текущий пароль' }).min(1, 'Укажите текущий пароль').max(72),
    newPassword: Password,
    newPasswordConfirm: z.string({ error: 'Повторите новый пароль' }),
  })
  .strict()
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Пароли не совпадают',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Новый пароль должен отличаться от текущего',
  })
  .meta({ id: 'PasswordChangeRequest' });

export const PasswordResetRequest = z.object({ email: Email }).strict().meta({ id: 'PasswordResetRequest' });

export const MessageResponse = z.object({ message: z.string() }).meta({ id: 'MessageResponse' });

export const TokenResponse = z
  .object({
    accessToken: z.string().describe('JWT; передавайте в заголовке Authorization: Bearer <token>'),
    tokenType: z.literal('Bearer'),
    expiresIn: z.number().int().describe('Срок действия токена, секунд'),
    user: UserResponse,
  })
  .meta({ id: 'TokenResponse' });

export type RegisterInput = z.output<typeof RegisterRequest>;
export type LoginInput = z.output<typeof LoginRequest>;
export type PasswordChangeInput = z.output<typeof PasswordChangeRequest>;
