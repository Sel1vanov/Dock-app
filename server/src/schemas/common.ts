/**
 * Общие схемы API (аналог Pydantic-моделей). Схемы описывают формат HTTP-запросов и ответов
 * и никак не связаны с ORM-моделями из src/models: ответ собирается явным маппингом,
 * поэтому служебные поля (password_hash и т. п.) в API попасть не могут.
 */
import { z } from 'zod';

/**
 * Российский номер телефона. Принимаются +7 916 123-45-67, 8 (916) 123-45-67, 79161234567 и 9161234567,
 * в БД всегда сохраняется один вид — «+7» и 10 цифр. Код после +7: 3xx, 4xx, 8xx или 9xx.
 */
export const Phone = z
  .string({ error: 'Укажите телефон' })
  .trim()
  .min(1, 'Укажите телефон')
  .regex(/^[+0-9\s\-()]+$/, 'Номер может содержать только цифры, пробелы, «+», «-» и скобки')
  .transform((s) => {
    const digits = s.replace(/\D/g, '');
    const national = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
    return `+7${national}`;
  })
  .pipe(z.string().regex(/^\+7[3489][0-9]{9}$/, 'Номер в формате +7 (999) 111-22-33'));

export const IdParams = z.object({
  id: z.uuid('Некорректный идентификатор'),
});

/** Поисковая строка: обрезаем пробелы, пустая строка = нет фильтра. */
export const SearchQuery = z
  .string()
  .trim()
  .max(100, 'Не больше 100 символов')
  .optional()
  .transform((v) => (v ? v : undefined));

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20).describe('Сколько записей вернуть (1–50)'),
  offset: z.coerce.number().int().min(0).max(100_000).default(0).describe('Сколько записей пропустить'),
});

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().describe('Всего записей под фильтром'),
    limit: z.number().int(),
    offset: z.number().int(),
  });
}

export const RatingResponse = z
  .object({
    average: z.number(),
    count: z.number().int(),
  })
  .nullable();

/** Положительное число с ограничением сверху (габариты, масса, цена). */
export const positive = (max: number, message: string) =>
  z
    .number({ error: `${message}: введите число` })
    .positive(`${message}: должно быть больше нуля`)
    .max(max, `${message}: не больше ${max}`);

export const ImageBase64 = z
  .string()
  .min(100, 'Изображение не передано')
  .max(7_500_000, 'Файл больше 5 МБ')
  .describe('JPEG или PNG в base64 (без префикса data:)');

export const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string().describe('Машиночитаемый код: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_ERROR …'),
      message: z.string().describe('Сообщение для пользователя'),
      details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/** Стандартные ответы с ошибками для документации Swagger. */
export const errorResponses = (...codes: (400 | 401 | 403 | 404 | 409 | 413 | 422 | 429)[]) =>
  Object.fromEntries(codes.map((code) => [code, ErrorResponse])) as Record<number, typeof ErrorResponse>;

export const NoContent = z.undefined().describe('Нет содержимого');
