import type { EntityManager } from '@mikro-orm/postgresql';

import type { Config } from '../core/config.js';
import type { FileStorage } from './FileStorage.js';

// что нужно сервису на время одного запроса: em этого запроса, конфиг и хранилище файлов
// собирается в dependencies.ts (как Depends в fastapi)
export interface ServiceContext {
  em: EntityManager;
  config: Config;
  storage: FileStorage;
}
