/**
 * Безопасность: хеширование паролей (bcrypt), JWT access-токены, подписанные ссылки на файлы.
 * Криптография — только готовые библиотеки (bcryptjs, jsonwebtoken, node:crypto).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import type { Config } from './config.js';
import type { UserRole } from '../models/enums.js';
import { UnauthorizedError } from './errors.js';

/** Стоимость bcrypt: 2^12 итераций — ~250 мс на хеш, заметно тормозит перебор паролей. */
const BCRYPT_ROUNDS = 12;

/** Хеш-заглушка: сравнение с ним, когда пользователь не найден, уравнивает время ответа. */
const DUMMY_HASH = bcrypt.hashSync('dock-timing-protection', BCRYPT_ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && Boolean(hash));
}

// ---------------------------------------------------------------------- JWT ---

const JWT_ISSUER = 'dock-api';
const JWT_AUDIENCE = 'dock-app';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export interface IssuedToken {
  accessToken: string;
  tokenType: 'Bearer';
  /** Через сколько секунд токен перестанет приниматься. */
  expiresIn: number;
}

export function createAccessToken(config: Pick<Config, 'JWT_SECRET' | 'JWT_EXPIRES_IN'>, payload: AccessTokenPayload): IssuedToken {
  const accessToken = jwt.sign({ role: payload.role }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: payload.sub,
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return { accessToken, tokenType: 'Bearer', expiresIn: config.JWT_EXPIRES_IN };
}

/** Проверяет подпись, алгоритм, издателя, аудиторию и срок действия токена. */
export function verifyAccessToken(config: Pick<Config, 'JWT_SECRET'>, token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (typeof decoded !== 'object' || typeof decoded.sub !== 'string' || typeof decoded.role !== 'string') {
      throw new UnauthorizedError('Недействительный токен');
    }
    return { sub: decoded.sub, role: decoded.role as UserRole };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Срок действия сессии истёк. Войдите снова', 'TOKEN_EXPIRED');
    }
    if (e instanceof UnauthorizedError) throw e;
    throw new UnauthorizedError('Недействительный токен');
  }
}

// -------------------------------------------------------- подписанные ссылки ---

function fileSignature(secret: string, key: string, expires: number): string {
  return createHmac('sha256', secret).update(`${key}:${expires}`).digest('base64url');
}

/** Временная ссылка на приватный файл (аналог signed URL в S3/Supabase Storage). */
export function signFileUrl(config: Pick<Config, 'FILE_URL_SECRET' | 'FILE_URL_TTL'>, key: string, now = Date.now()): string {
  const expires = Math.floor(now / 1000) + config.FILE_URL_TTL;
  const signature = fileSignature(config.FILE_URL_SECRET, key, expires);
  return `/api/v1/files/${key}?expires=${expires}&signature=${signature}`;
}

export function verifyFileSignature(
  config: Pick<Config, 'FILE_URL_SECRET'>,
  key: string,
  expires: number,
  signature: string,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(expires) || expires < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(fileSignature(config.FILE_URL_SECRET, key, expires));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
