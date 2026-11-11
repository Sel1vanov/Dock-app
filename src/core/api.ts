/**
 * HTTP-клиент API v1. Добавляет заголовок Authorization: Bearer <JWT>, разбирает ответы
 * и ошибки сервера. При 401 (токен истёк или недействителен) сообщает AuthViewModel,
 * чтобы удалить токен и вернуть пользователя на экран входа.
 *
 * Пока приложением пользуются, токен тихо продлевается (POST /auth/refresh): срок его жизни
 * остаётся коротким, но пароль заново вводить не приходится.
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

// ------------------------------------------------------ продление сессии ---

/** Когда токен пора продлить (мс). 0 — токен взят из хранилища при запуске: продлеваем при первом же запросе. */
let renewAfter = 0;
let isRenewing = false;
/** После неудачной попытки (нет сети, сессия слишком давняя) следующую делаем не раньше чем через 5 минут. */
const RENEW_RETRY_MS = 5 * 60_000;

/** Сохранить выданный сервером токен; продлевать его начнём с половины срока действия. */
export async function saveToken(issued: { accessToken: string; expiresIn: number }): Promise<void> {
  await tokenStorage.set(issued.accessToken);
  renewAfter = Date.now() + (issued.expiresIn * 1000) / 2;
}

/** Вызывается после каждого успешного запроса с токеном: если подошло время — получить новый токен. */
async function renewSessionIfDue(): Promise<void> {
  if (isRenewing || Date.now() < renewAfter) return;
  isRenewing = true;
  try {
    const current = await tokenStorage.get();
    if (!current) return;
    const issued = await apiRequest<{ accessToken: string; expiresIn: number }>('POST', '/auth/refresh', {
      isSessionRenewal: true,
    });
    // Пока шёл запрос, пользователь мог выйти или войти под другим аккаунтом — тогда новый токен не нужен
    if ((await tokenStorage.get()) === current) await saveToken(issued);
  } catch {
    // Продлить не удалось: текущий токен действует до конца своего срока, попробуем позже
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
  // 401 на защищённом запросе — токен истёк или отозван: завершаем сессию.
  // Отказ в продлении сессию не завершает: текущий токен ещё действует.
  if (response.status === 401 && token && !options.isSessionRenewal) unauthorizedHandler?.(apiError.message);
  throw apiError;
}

/** Абсолютная ссылка на файл (сервер отдаёт относительный путь с подписью). */
export const fileUrl = (path: string) => (path.startsWith('http') ? path : `${API_URL}${path}`);
