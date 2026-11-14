// пароли (bcrypt), jwt и подписанные ссылки на файлы
// свою криптографию не пишу, только готовые либы (bcryptjs, jsonwebtoken, node:crypto)
import { createHmac, timingSafeEqual } from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import type { Config } from './config.js';
import type { UserRole } from '../models/enums.js';
import { UnauthorizedError } from './errors.js';

// 2^12 раундов, это ~250 мс на хеш - перебирать пароли будет долго
const BCRYPT_ROUNDS = 12;

// хеш-пустышка: если юзера нет, все равно сравниваю с ним, чтобы время ответа было такое же
const DUMMY_HASH = bcrypt.hashSync('dock-timing-protection', BCRYPT_ROUNDS);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// версия пароля для токена = время последней смены в мс (0 - не меняли)
export const passwordVersion = (changedAt: Date | null) => changedAt?.getTime() ?? 0;

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH).then((ok) => ok && Boolean(hash));
}

// --- jwt ---

const JWT_ISSUER = 'dock-api';
const JWT_AUDIENCE = 'dock-app';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  // версия пароля (см. passwordVersion). сменил пароль - старые токены перестают работать
  pwv: number;
  // когда юзер реально ввел пароль (unix сек). при продлении переносится в новый токен как есть,
  // поэтому бесконечно продлевать не получится (SESSION_MAX_AGE)
  sst: number;
}

export interface IssuedToken {
  accessToken: string;
  tokenType: 'Bearer';
  // через сколько секунд токен протухнет
  expiresIn: number;
}

// sessionStartedAt нет - новая сессия (логин, регистрация, смена пароля), есть - продление старой
export function createAccessToken(
  config: Pick<Config, 'JWT_SECRET' | 'JWT_EXPIRES_IN'>,
  payload: Omit<AccessTokenPayload, 'sst'>,
  sessionStartedAt = Math.floor(Date.now() / 1000),
): IssuedToken {
  const claims = { role: payload.role, pwv: payload.pwv, sst: sessionStartedAt };
  const accessToken = jwt.sign(claims, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: payload.sub,
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return { accessToken, tokenType: 'Bearer', expiresIn: config.JWT_EXPIRES_IN };
}

// проверяет подпись, алгоритм, issuer, audience и срок
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
    return {
      sub: decoded.sub,
      role: decoded.role as UserRole,
      pwv: typeof decoded.pwv === 'number' ? decoded.pwv : 0,
      sst: typeof decoded.sst === 'number' ? decoded.sst : (decoded.iat ?? 0),
    };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Срок действия сессии истёк. Войдите снова', 'TOKEN_EXPIRED');
    }
    if (e instanceof UnauthorizedError) throw e;
    throw new UnauthorizedError('Недействительный токен');
  }
}

// --- подписанные ссылки на файлы ---

function fileSignature(secret: string, key: string, expires: number): string {
  return createHmac('sha256', secret).update(`${key}:${expires}`).digest('base64url');
}

// временная ссылка на приватный файл (как signed url в s3)
export function signFileUrl(
  config: Pick<Config, 'FILE_URL_SECRET' | 'FILE_URL_TTL'>,
  key: string,
  now = Date.now(),
): string {
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
