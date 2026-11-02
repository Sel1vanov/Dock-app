/**
 * Список миграций в порядке применения (аналог цепочки ревизий Alembic).
 * Явный список вместо поиска файлов: одинаково работает в tsx, в тестах и в собранном коде.
 */
import type { MigrationObject } from '@mikro-orm/core';

import { Migration20261028100000_initial_schema } from './Migration20261028100000_initial_schema.js';
import { Migration20261028110000_verification_and_search } from './Migration20261028110000_verification_and_search.js';
import { Migration20261029100000_notifications_and_bargaining } from './Migration20261029100000_notifications_and_bargaining.js';
import { Migration20261029120000_phone_format } from './Migration20261029120000_phone_format.js';
import { Migration20261103100000_disputes } from './Migration20261103100000_disputes.js';

export const migrationsList: MigrationObject[] = [
  { name: 'Migration20261028100000_initial_schema', class: Migration20261028100000_initial_schema },
  { name: 'Migration20261028110000_verification_and_search', class: Migration20261028110000_verification_and_search },
  {
    name: 'Migration20261029100000_notifications_and_bargaining',
    class: Migration20261029100000_notifications_and_bargaining,
  },
  { name: 'Migration20261029120000_phone_format', class: Migration20261029120000_phone_format },
  { name: 'Migration20261103100000_disputes', class: Migration20261103100000_disputes },
];
