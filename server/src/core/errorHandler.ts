/**
 * Единая обработка ошибок. Клиент получает только код и понятное сообщение
 * ({ error: { code, message, details? } }); стек, SQL и текст исключения пишутся в серверный журнал.
 */
import {
  CheckConstraintViolationException,
  DriverException,
  ForeignKeyConstraintViolationException,
  NotNullConstraintViolationException,
  UniqueConstraintViolationException,
} from '@mikro-orm/core';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod';

import { AppError, type ErrorCode, type FieldError } from './errors.js';

function send(reply: FastifyReply, status: number, code: ErrorCode, message: string, details?: FieldError[]) {
  return reply.status(status).send({ error: { code, message, ...(details?.length ? { details } : {}) } });
}

/**
 * Нарушение внешнего ключа. PostgreSQL сообщает о нём двумя кодами: 23503 (foreign_key_violation) и, в новых
 * версиях для правила ON DELETE RESTRICT, 23001 (restrict_violation: «violates RESTRICT setting of foreign key
 * constraint»). MikroORM распознаёт только 23503, поэтому 23001 проверяем по коду сами.
 */
export function isForeignKeyViolation(error: unknown): boolean {
  return (
    error instanceof ForeignKeyConstraintViolationException ||
    (error instanceof DriverException && error.code === '23001')
  );
}

/** '/cargoTypeCodes/0' → 'cargoTypeCodes' — имя поля формы, к которому относится ошибка. */
function fieldOf(instancePath: string, fallback: string): string {
  const parts = instancePath.split('/').filter(Boolean);
  return parts.find((p) => !/^\d+$/.test(p)) ?? fallback;
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // 422 — тело, параметры или query не прошли проверку схемой
    if (hasZodFastifySchemaValidationErrors(error)) {
      const context = (error as { validationContext?: string }).validationContext ?? 'body';
      const details = error.validation.map((v) => ({
        field: fieldOf(v.instancePath, context),
        message: v.message ?? 'Некорректное значение',
      }));
      return send(reply, 422, 'VALIDATION_ERROR', details[0]?.message ?? 'Проверьте введённые данные', details);
    }

    if (error instanceof AppError) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        request.log.warn({ code: error.code, url: request.url }, error.message);
      }
      return send(reply, error.statusCode, error.code, error.message, error.details);
    }

    // Ограничения целостности БД — последний рубеж, если проверка сервиса что-то пропустила
    if (error instanceof UniqueConstraintViolationException) {
      request.log.warn({ err: error }, 'unique constraint violation');
      return send(reply, 409, 'CONFLICT', 'Запись с такими данными уже существует');
    }
    if (isForeignKeyViolation(error)) {
      request.log.warn({ err: error }, 'foreign key violation');
      return send(reply, 409, 'CONFLICT', 'Операция нарушает связи между данными');
    }
    if (error instanceof CheckConstraintViolationException || error instanceof NotNullConstraintViolationException) {
      request.log.warn({ err: error }, 'check constraint violation');
      return send(reply, 422, 'VALIDATION_ERROR', 'Данные не прошли проверку целостности');
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, issues: error.cause.issues }, 'response does not match schema');
      return send(reply, 500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера');
    }

    // Ошибки самого Fastify (битый JSON, слишком большое тело, лимит запросов)
    const status = error.statusCode ?? 500;
    if (status === 413) return send(reply, 413, 'PAYLOAD_TOO_LARGE', 'Слишком большой запрос (файл больше 5 МБ)');
    if (status === 429) return send(reply, 429, 'TOO_MANY_REQUESTS', 'Слишком много попыток. Повторите через минуту');
    if (status >= 400 && status < 500) {
      return send(
        reply,
        400,
        'BAD_REQUEST',
        error.code === 'FST_ERR_CTP_INVALID_JSON_BODY' ? 'Некорректный JSON' : 'Некорректный запрос',
      );
    }

    request.log.error({ err: error }, 'unhandled error');
    return send(reply, 500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера. Попробуйте позже');
  });

  app.setNotFoundHandler((request, reply) =>
    send(reply, 404, 'NOT_FOUND', `Маршрут ${request.method} ${request.url.split('?')[0]} не найден`),
  );
}
