/**
 * Ошибки приложения с понятным пользователю текстом. HTTP-клиент переводит ответы сервера
 * в ApiError, чтобы верхние слои не зависели от деталей транспорта.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Ошибка от сервера: HTTP-статус, машиночитаемый код и ошибки по полям формы (422). */
export class ApiError extends AppError {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

export function toAppError(error: unknown, fallback = 'Что-то пошло не так'): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : '';
  if (/network request failed|failed to fetch|fetch failed|load failed/i.test(message)) {
    return new AppError('Нет соединения с сервером. Проверьте интернет и что сервер API запущен', error);
  }
  return new AppError(fallback, error);
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
