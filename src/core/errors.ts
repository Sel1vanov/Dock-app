/**
 * Ошибка приложения с понятным пользователю текстом.
 * Репозитории переводят в неё ошибки Supabase, чтобы верхние слои не зависели от SDK.
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

const KNOWN_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, 'Неверный email или пароль'],
  [/email not confirmed/i, 'Email не подтверждён. Перейдите по ссылке из письма и войдите снова'],
  [/user already registered/i, 'Пользователь с таким email уже зарегистрирован'],
  [/password should be at least/i, 'Пароль слишком короткий (минимум 6 символов)'],
  [/rate limit/i, 'Слишком много попыток. Повторите через минуту'],
  [/row-level security/i, 'Недостаточно прав для этого действия'],
  [/duplicate key.*uk_order_driver/i, 'Вы уже откликнулись на эту заявку'],
  [/duplicate key.*uk_review_order_author/i, 'Вы уже оставили отзыв по этому заказу'],
  [/network request failed|failed to fetch|fetch failed/i, 'Нет соединения с сервером'],
];

export function toAppError(error: unknown, fallback = 'Что-то пошло не так'): AppError {
  if (error instanceof AppError) return error;
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  for (const [pattern, text] of KNOWN_MESSAGES) {
    if (pattern.test(message)) return new AppError(text, error);
  }
  // Сообщения из триггеров БД (raise exception) уже написаны по-русски — показываем как есть.
  if (/[а-яё]/i.test(message)) return new AppError(message, error);
  return new AppError(message ? `${fallback}: ${message}` : fallback, error);
}

export function errorMessage(error: unknown): string {
  return toAppError(error).message;
}
