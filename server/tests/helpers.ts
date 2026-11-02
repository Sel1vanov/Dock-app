/**
 * Общая подготовка тестов: отдельная тестовая БД PostgreSQL, развёрнутая с нуля миграциями,
 * и приложение Fastify, к которому запросы отправляются через app.inject() (без сети).
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { MikroORM } from '@mikro-orm/postgresql';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { buildApp } from '../src/app.js';
import { type Config, loadConfig, loadEnvFile } from '../src/core/config.js';
import { initOrm } from '../src/database/orm.js';
import { User, UserRole, VerificationStatus } from '../src/models/index.js';
import { hashPassword } from '../src/core/security.js';

loadEnvFile();

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dock_test';

/** 1×1 JPEG — достаточно, чтобы пройти проверку сигнатуры файла. */
export const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

export interface TestContext {
  app: FastifyInstance;
  orm: MikroORM;
  config: Config;
  /** SQL-запросы ORM, выполненные с момента последнего clearQueries() (для проверки N+1). */
  queries: string[];
  close: () => Promise<void>;
}

/** Пустая БД → миграции → приложение. Каждый тестовый файл начинает с чистой схемы. */
export async function setupTestApp(): Promise<TestContext> {
  const filesDir = await mkdtemp(join(tmpdir(), 'dock-files-'));
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    JWT_SECRET: 'test-jwt-secret-test-jwt-secret-0123456789',
    JWT_EXPIRES_IN: '3600',
    FILE_URL_SECRET: 'test-file-secret-test-file-secret-0123456789',
    FILES_DIR: filesDir,
    LOG_LEVEL: 'silent',
    DB_DEBUG: 'false',
  });

  const queries: string[] = [];
  const orm = await initOrm(config, {
    debug: ['query'],
    colors: false,
    logger: (message) => {
      const plain = message.replace(/\x1b\[[0-9;]*m/g, '');
      if (plain.includes('[query]')) queries.push(plain);
    },
  });
  await orm.schema.ensureDatabase();
  await orm.em.fork().execute('drop schema if exists public cascade; create schema public;');
  await orm.migrator.up(); // схема создаётся ТОЛЬКО миграциями
  queries.length = 0;

  const app = await buildApp({ config, orm });
  await app.ready();

  return {
    app,
    orm,
    config,
    queries,
    close: async () => {
      await app.close();
      await orm.close();
      await rm(filesDir, { recursive: true, force: true });
    },
  };
}

// ------------------------------------------------------------- запросы ---

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api(
  ctx: TestContext,
  method: Method,
  url: string,
  options: { token?: string; body?: unknown } = {},
): Promise<LightMyRequestResponse & { data: any }> {
  const response = await ctx.app.inject({
    method,
    url: `/api/v1${url}`,
    headers: options.token ? { authorization: `Bearer ${options.token}` } : {},
    ...(options.body !== undefined ? { payload: options.body as object } : {}),
  });
  const data = response.body ? safeJson(response.body) : undefined;
  return Object.assign(response, { data });
}

function safeJson(body: string) {
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

let counter = 0;

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export async function registerUser(
  ctx: TestContext,
  role: 'Client' | 'Driver',
  overrides: Record<string, unknown> = {},
): Promise<TestUser> {
  counter += 1;
  const email = `${role.toLowerCase()}${counter}@test.ru`;
  const response = await api(ctx, 'POST', '/auth/register', {
    body: {
      email,
      password: 'Secret123',
      passwordConfirm: 'Secret123',
      fullName: `${role === 'Client' ? 'Заказчик' : 'Водитель'} ${counter}`,
      phone: `+7999000${String(counter).padStart(4, '0')}`,
      role,
      ...overrides,
    },
  });
  if (response.statusCode !== 201) throw new Error(`register failed: ${response.body}`);
  return { id: response.data.user.id, email, token: response.data.accessToken };
}

/** Администратора нельзя зарегистрировать через API — создаём его напрямую через ORM. */
export async function createAdmin(ctx: TestContext): Promise<TestUser> {
  const em = ctx.orm.em.fork();
  counter += 1;
  const email = `admin${counter}@test.ru`;
  em.create(User, {
    email,
    passwordHash: await hashPassword('Secret123'),
    role: UserRole.Admin,
    fullName: 'Администратор',
    phone: '+79990000000',
  });
  await em.flush();
  const login = await api(ctx, 'POST', '/auth/login', { body: { email, password: 'Secret123' } });
  return { id: login.data.user.id, email, token: login.data.accessToken };
}

/** Водитель с подтверждёнными документами и ТС под тип груза Machinery. */
export async function createVerifiedDriver(ctx: TestContext, vehicle: Record<string, unknown> = {}) {
  const driver = await registerUser(ctx, 'Driver');
  const em = ctx.orm.em.fork();
  await em.nativeUpdate(User, { id: driver.id }, { verificationStatus: VerificationStatus.Verified });
  const created = await api(ctx, 'POST', '/vehicles', {
    token: driver.token,
    body: {
      type: 'Trawl',
      model: 'Тестовый трал',
      maxWeightKg: 30000,
      lengthM: 13.6,
      widthM: 3.2,
      heightM: 3.5,
      cargoTypeCodes: ['Machinery', 'Equipment'],
      ...vehicle,
    },
  });
  if (created.statusCode !== 201) throw new Error(`vehicle failed: ${created.body}`);
  return { ...driver, vehicleId: created.data.id as string };
}

export const ORDER_BODY = {
  cargoTypeCode: 'Machinery',
  description: 'Экскаватор JCB 3CX',
  weightKg: 8300,
  lengthM: 6.9,
  widthM: 2.4,
  heightM: 3.1,
  originAddress: 'Москва, ул. Складочная, 1',
  destinationAddress: 'Тверь, Промышленная ул., 12',
  price: 45000,
};

export async function createOrder(ctx: TestContext, token: string, body: Record<string, unknown> = {}) {
  const response = await api(ctx, 'POST', '/orders', { token, body: { ...ORDER_BODY, ...body } });
  if (response.statusCode !== 201) throw new Error(`order failed: ${response.body}`);
  return response.data as { id: string; [key: string]: any };
}
