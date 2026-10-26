/**
 * Схемы валидации входных данных форм (аналог Pydantic-схем из лекции, библиотека zod).
 * Форма хранит строки, схема проверяет их и превращает в типизированный объект.
 */
import { z } from 'zod';

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

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, 'Укажите имя'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{10,18}$/, 'Телефон в формате +7 999 111-22-33'),
  role: z.enum(['Client', 'Driver']),
});

export const cargoSchema = z.object({
  type: z.enum(['Car', 'Container', 'Machinery', 'Agricultural', 'Equipment', 'Other']),
  description: z.string().trim().max(500, 'Не больше 500 символов'),
  lengthM: decimal('Длина', 'длину', 0.1, 40),
  widthM: decimal('Ширина', 'ширину', 0.1, 10),
  heightM: decimal('Высота', 'высоту', 0.1, 8),
  weightT: decimal('Масса', 'массу', 0.01, 200),
});

export const createOrderSchema = cargoSchema.extend({
  origin: z.string().trim().min(3, 'Укажите адрес погрузки'),
  destination: z.string().trim().min(3, 'Укажите адрес выгрузки'),
  price: decimal('Цена', 'цену', 1000, 100_000_000),
});

export const vehicleSchema = z.object({
  type: z.enum(['Trawl', 'Manipulator', 'TowTruck', 'Flatbed', 'Other']),
  model: z.string().trim().max(80),
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

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
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
