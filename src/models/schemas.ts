/**
 * Схемы проверки форм до отправки запроса (те же правила, что у схем сервера, — библиотека zod).
 * Форма хранит строки, схема проверяет обязательные поля, формат и диапазоны и превращает
 * их в типизированный объект. Окончательная проверка всё равно выполняется на сервере.
 */
import { z } from 'zod';

import { normalizePhone } from '../core/phone';

/** Число из текстового поля: допускает запятую, проверяет диапазон. */
const decimal = (title: string, accusative: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Укажите ${accusative}`)
    .transform((s) => Number(s.replace(',', '.').replace(/\s/g, '')))
    .refine((n) => Number.isFinite(n), `${title}: введите число`)
    .refine((n) => n >= min, `${title}: не меньше ${min}`)
    .refine((n) => n <= max, `${title}: не больше ${max}`);

const email = z.string().trim().toLowerCase().min(1, 'Укажите email').email('Некорректный email');

/** Российский номер; на сервер уходит в виде +79991112233. */
const phone = z
  .string()
  .trim()
  .min(1, 'Укажите телефон')
  .transform((s, ctx) => {
    const normalized = normalizePhone(s);
    if (!normalized) ctx.addIssue({ code: 'custom', message: 'Номер в формате +7 (999) 111-22-33' });
    return normalized ?? s;
  });

const fullName = z.string().trim().min(2, 'Укажите имя').max(100, 'Не больше 100 символов');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Укажите пароль'),
});

/** Правила пароля — те же, что на сервере. */
const newPassword = z
  .string()
  .min(8, 'Минимум 8 символов')
  .max(72, 'Не больше 72 символов')
  .regex(/[A-Za-zА-Яа-яЁё]/, 'Добавьте хотя бы одну букву')
  .regex(/[0-9]/, 'Добавьте хотя бы одну цифру');

export const signUpSchema = z
  .object({
    email,
    password: newPassword,
    passwordConfirm: z.string().min(1, 'Повторите пароль'),
    fullName,
    phone,
    role: z.enum(['Client', 'Driver']),
  })
  .refine((v) => v.password === v.passwordConfirm, { path: ['passwordConfirm'], message: 'Пароли не совпадают' });

export const profileSchema = z.object({ fullName, phone });

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Укажите текущий пароль'),
    newPassword,
    newPasswordConfirm: z.string().min(1, 'Повторите новый пароль'),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Пароли не совпадают',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'Новый пароль должен отличаться от текущего',
  });

export const passwordResetSchema = z.object({ email });

export const cargoSchema = z.object({
  type: z.enum(['Car', 'Container', 'Machinery', 'Agricultural', 'Equipment', 'Other']),
  description: z.string().trim().max(500, 'Не больше 500 символов'),
  lengthM: decimal('Длина', 'длину', 0.1, 40),
  widthM: decimal('Ширина', 'ширину', 0.1, 10),
  heightM: decimal('Высота', 'высоту', 0.1, 8),
  weightT: decimal('Масса', 'массу', 0.01, 200),
});

export const createOrderSchema = cargoSchema.extend({
  origin: z.string().trim().min(3, 'Укажите адрес погрузки').max(300, 'Не больше 300 символов'),
  destination: z.string().trim().min(3, 'Укажите адрес выгрузки').max(300, 'Не больше 300 символов'),
  price: decimal('Цена', 'цену', 1000, 100_000_000),
});

export const vehicleSchema = z.object({
  type: z.enum(['Trawl', 'Manipulator', 'TowTruck', 'Flatbed', 'Other']),
  model: z.string().trim().max(80, 'Не больше 80 символов'),
  cargoTypes: z
    .array(z.enum(['Car', 'Container', 'Machinery', 'Agricultural', 'Equipment', 'Other']))
    .min(1, 'Выберите хотя бы один тип груза'),
  lengthM: decimal('Длина', 'длину платформы', 1, 40),
  widthM: decimal('Ширина', 'ширину платформы', 1, 6),
  heightM: decimal('Высота', 'допустимую высоту груза', 0.5, 8),
  weightT: decimal('Грузоподъёмность', 'грузоподъёмность', 0.5, 200),
});

export const bidSchema = z.object({
  price: decimal('Цена', 'цену', 1000, 100_000_000),
  comment: z.string().trim().max(300, 'Не больше 300 символов'),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Поставьте оценку').max(5),
  comment: z.string().trim().max(500),
});

export type SignInInput = z.output<typeof signInSchema>;
export type SignUpForm = z.input<typeof signUpSchema>;
export type SignUpInput = z.output<typeof signUpSchema>;
export type ProfileForm = z.input<typeof profileSchema>;
export type PasswordChangeForm = z.input<typeof passwordChangeSchema>;
export type PasswordChangeInput = z.output<typeof passwordChangeSchema>;
export type CreateOrderForm = z.input<typeof createOrderSchema>;
export type CreateOrderInput = z.output<typeof createOrderSchema>;
export type VehicleForm = z.input<typeof vehicleSchema>;
export type VehicleInput = z.output<typeof vehicleSchema>;
export type BidForm = z.input<typeof bidSchema>;
export type BidInput = z.output<typeof bidSchema>;
export type ReviewInput = z.output<typeof reviewSchema>;

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Проверка формы: либо данные, либо ошибки по полям. */
export function validate<S extends z.ZodType>(
  schema: S,
  values: z.input<S>,
): { ok: true; data: z.output<S> } | { ok: false; errors: FieldErrors<z.input<S>> } {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_');
    errors[key] ??= issue.message;
  }
  return { ok: false, errors: errors as FieldErrors<z.input<S>> };
}
