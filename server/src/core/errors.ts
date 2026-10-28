/**
 * Ошибки приложения. Сервисы бросают их с понятным пользователю текстом, а единый обработчик
 * (core/errorHandler.ts) превращает в HTTP-ответ с нужным кодом. Внутренние исключения
 * (SQL, стек вызовов) клиенту не передаются — только в серверный журнал.
 */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** 401 — нет токена, токен поддельный или истёк. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Требуется авторизация', code: 'UNAUTHORIZED' | 'TOKEN_EXPIRED' = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

/** 403 — пользователь известен, но прав на действие нет. */
export class ForbiddenError extends AppError {
  constructor(message = 'Недостаточно прав для этого действия') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Запись не найдена') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 409 — запрос корректен, но противоречит текущему состоянию данных (дубликат, статус заказа). */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

/** 422 — данные не прошли проверку. */
export class ValidationError extends AppError {
  constructor(message: string, details?: FieldError[]) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}
