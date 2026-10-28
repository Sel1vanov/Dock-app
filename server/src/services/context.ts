import type { EntityManager } from '@mikro-orm/postgresql';

import type { Config } from '../core/config.js';
import type { FileStorage } from './FileStorage.js';

/**
 * Зависимости сервиса на время одного HTTP-запроса: Session (EntityManager) этого запроса,
 * конфигурация и файловое хранилище. Создаётся в dependencies.ts (аналог Depends в FastAPI).
 */
export interface ServiceContext {
  em: EntityManager;
  config: Config;
  storage: FileStorage;
}
