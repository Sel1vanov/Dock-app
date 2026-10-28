/**
 * Подключение ORM к PostgreSQL (слой database). Параметры приходят из Config,
 * а не читаются здесь из окружения.
 */
import { Migrator } from '@mikro-orm/migrations';
import { defineConfig, MikroORM, type Options } from '@mikro-orm/postgresql';

import type { Config } from '../core/config.js';
import { entities } from '../models/index.js';
import { migrationsList } from './migrations/index.js';

type OrmConfig = Pick<Config, 'DATABASE_URL' | 'DATABASE_SSL' | 'DB_DEBUG'>;

export function ormOptions(config: OrmConfig, overrides: Partial<Options> = {}): Options {
  return defineConfig({
    clientUrl: config.DATABASE_URL,
    driverOptions: config.DATABASE_SSL ? { ssl: { rejectUnauthorized: false } } : undefined,
    entities,
    extensions: [Migrator],
    migrations: {
      tableName: 'mikro_orm_migrations',
      migrationsList,
      snapshot: false,
      silent: true,
    },
    // Связанные данные по умолчанию: to-one — JOIN, to-many — отдельным запросом IN (…).
    loadStrategy: 'balanced',
    // Без явного fork() глобальный EntityManager использовать запрещено: Session — на запрос.
    allowGlobalContext: false,
    debug: config.DB_DEBUG ? ['query', 'query-params'] : false,
    pool: { min: 0, max: 10 },
    ...overrides,
  });
}

export function initOrm(config: OrmConfig, overrides: Partial<Options> = {}): Promise<MikroORM> {
  return MikroORM.init(ormOptions(config, overrides));
}
