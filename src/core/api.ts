// http-клиент для api v1. сам ставит Authorization: Bearer <JWT>, разбирает ответы
// и ошибки сервера. на 401 (токен протух или отозван) дергает AuthViewModel,
// чтобы тот удалил токен и вернул юзера на экран входа
//
// пока приложением пользуются, токен тихо продлевается (POST /auth/refresh):
// живет он недолго, но пароль заново вводить не приходится
import { API_BASE, API_URL } from './config';
import { ApiError, AppError, toAppError } from './errors';
import { tokenStorage } from './tokenStorage';

type Query = Record<string, string | number | boolean | undefined | null>;

let unauthorizedHandler: ((reason: string) => void) | null = null;

// подписка на "сессия больше не действует" (обработчик один - AuthViewModel)
export function onUnauthorized(handler: ((reason: string) => void) | null) {
  unauthorizedHandler = handler;
}

const REQUEST_TIMEOUT_MS = 20_000;

// --- продление сессии ---

// когда пора продлевать токен (мс). 0 - токен достали из хранилища при запуске, продлеваем на первом же запросе
let renewAfter = 0;
let isRenewing = false;
// если продлить не вышло (нет сети, сессия слишком старая) - следующая попытка не раньше чем через 5 минут
const RENEW_RETRY_MS = 5 * 60_000;

// сохранить токен от сервера. продлевать начнем с половины его срока
export async function saveToken(issued: { accessToken: string; expiresIn: number }): Promise<void> {
  await tokenStorage.set(issued.accessToken);
  renewAfter = Date.now() + (issued.expiresIn * 1000) / 2;
}

// вызывается после каждого успешного запроса с токеном: если пора - берем новый токен
async function renewSessionIfDue(): Promise<void> {
  if (isRenewing || Date.now() < renewAfter) return;
  isRenewing = true;
  try {
    const current = await tokenStorage.get();
    if (!current) return;
    const issued = await apiRequest<{ accessToken: string; expiresIn: number }>('POST', '/auth/refresh', {
      isSessionRenewal: true,
    });
    // пока шел запрос, юзер мог выйти или зайти под другим аккаунтом - тогда новый токен не нужен
    if ((await tokenStorage.get()) === current) await saveToken(issued);
  } catch {
    // продлить не получилось: текущий токен еще работает до конца срока, попробуем позже
    renewAfter = Date.now() + RENEW_RETRY_MS;
  } finally {
    isRenewing = false;
  }
}

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
  options: { body?: unknown; query?: Query; auth?: boolean; isSessionRenewal?: boolean } = {},
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

  if (response.ok && token && !options.isSessionRenewal) void renewSessionIfDue();
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
  // 401 на закрытом запросе - токен протух или отозван, завершаем сессию
  // а вот отказ в продлении сессию не завершает: текущий токен еще живой
  if (response.status === 401 && token && !options.isSessionRenewal) unauthorizedHandler?.(apiError.message);
  throw apiError;
}

// абсолютная ссылка на файл (сервер отдает относительный путь с подписью)
export const fileUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);
