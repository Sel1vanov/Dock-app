/**
 * Конфигурация сервера. Все параметры подключения и секреты берутся только из переменных окружения
 * (файл server/.env не попадает в git, образец — server/.env.example). Бизнес-логика к process.env
 * не обращается — она получает готовый объект Config.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  DATABASE_URL: z
    .string({ error: 'Не задан DATABASE_URL — вставьте строку подключения к базе в server/.env' })
    .url('DATABASE_URL должен быть строкой подключения postgres://… (проверьте server/.env)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET: не короче 32 символов'),
  /** Время жизни access-токена в секундах. */
  JWT_EXPIRES_IN: z.coerce.number().int().min(60).max(86_400).default(3600),
  /**
   * Сколько секунд сессию можно продлевать без повторного ввода пароля (по умолчанию 30 дней).
   * Пока приложением пользуются, токен тихо обновляется; после этого срока нужен новый вход.
   */
  SESSION_MAX_AGE: z.coerce.number().int().min(3600).max(31_536_000).default(2_592_000),
  FILE_URL_SECRET: z.string().min(32, 'FILE_URL_SECRET: не короче 32 символов'),
  /** Время жизни подписанной ссылки на файл в секундах. */
  FILE_URL_TTL: z.coerce.number().int().min(60).max(86_400).default(3600),
  FILES_DIR: z.string().default('./storage'),
  /** Разрешённые origin для веб-клиента через запятую; "*" — любой (только для разработки). */
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Логировать SQL-запросы ORM (для демонстрации загрузки связей без N+1). */
  DB_DEBUG: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof envSchema>;

/** Подхватывает server/.env, если он есть (переменные окружения процесса имеют приоритет). */
export function loadEnvFile(path = resolve(import.meta.dirname, '../../.env')): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Некорректная конфигурация окружения:\n${problems}\nСм. server/.env.example`);
  }
  return parsed.data;
}
