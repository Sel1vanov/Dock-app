/**
 * HTTP-клиент API v1. Добавляет заголовок Authorization: Bearer <JWT>, разбирает ответы
 * и ошибки сервера. При 401 (токен истёк или недействителен) сообщает AuthViewModel,
 * чтобы удалить токен и вернуть пользователя на экран входа.
 */
import { API_BASE, API_URL } from './config';
import { ApiError, AppError, toAppError } from './errors';
import { tokenStorage } from './tokenStorage';

type Query = Record<string, string | number | boolean | undefined | null>;

let unauthorizedHandler: ((reason: string) => void) | null = null;

/** Подписка на «сессия больше не действительна» (один обработчик — AuthViewModel). */
export function onUnauthorized(handler: ((reason: string) => void) | null) {
  unauthorizedHandler = handler;
}

const REQUEST_TIMEOUT_MS = 20_000;

function buildUrl(path: string, query?: Query): string {
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${API_BASE}${path}${params ? `?${params}` : ''}`;
}

export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: { body?: unknown; query?: Query; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.auth === false ? null : await tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (controller.signal.aborted) throw new AppError('Сервер не отвечает. Попробуйте ещё раз', e);
    throw toAppError(e);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (response.ok) return data as T;

  const error = data?.error;
  const fieldErrors: Record<string, string> = {};
  for (const d of error?.details ?? []) fieldErrors[d.field] ??= d.message;
  const apiError = new ApiError(
    response.status,
    error?.code ?? 'UNKNOWN',
    error?.message ?? (response.status >= 500 ? 'Ошибка сервера. Попробуйте позже' : 'Запрос не выполнен'),
    fieldErrors,
  );
  // 401 на защищённом запросе — токен истёк или отозван: завершаем сессию.
  if (response.status === 401 && token) unauthorizedHandler?.(apiError.message);
  throw apiError;
}

/** Абсолютная ссылка на файл (сервер отдаёт относительный путь с подписью). */
export const fileUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);
