/**
 * CLI миграций (аналог `alembic upgrade/downgrade/current`):
 *   npm run db:migrate            — применить все новые миграции
 *   npm run db:migrate -- down    — откатить последнюю миграцию
 *   npm run db:migrate -- status  — какие миграции применены, какие ждут
 */
import { loadConfig, loadEnvFile } from '../core/config.js';
import { initOrm } from './orm.js';

loadEnvFile();
const config = loadConfig();
const command = process.argv[2] ?? 'up';

// Какая база используется — видно сразу (без пароля). Не localhost — значит, это не PostgreSQL из Docker.
const db = new URL(config.DATABASE_URL);
const target = `${db.hostname}:${db.port || 5432}${db.pathname}`;
console.log(`База данных: ${target}`);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(db.hostname)) {
  console.warn(
    `⚠ Это не локальная база из Docker. Если так и задумано — всё в порядке; иначе исправьте DATABASE_URL в server/.env ` +
      `на postgres://postgres:postgres@localhost:5432/dock`,
  );
}

const orm = await initOrm(config);

try {
  if (command === 'up') {
    const applied = await orm.migrator.up();
    console.log(applied.length ? `Применены: ${applied.map((m) => m.name).join(', ')}` : 'Новых миграций нет');
  } else if (command === 'down') {
    const reverted = await orm.migrator.down();
    console.log(reverted.length ? `Откачены: ${reverted.map((m) => m.name).join(', ')}` : 'Нечего откатывать');
  } else if (command === 'status') {
    const executed = await orm.migrator.getExecuted();
    const pending = await orm.migrator.getPending();
    for (const m of executed) console.log(`[применена] ${m.name}`);
    for (const m of pending) console.log(`[ожидает]   ${m.name}`);
  } else {
    console.error(`Неизвестная команда: ${command}. Используйте up | down | status`);
    process.exitCode = 1;
  }
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error('Ошибка миграции:', message);
  if (/already exists/i.test(message)) {
    console.error(
      'База не пустая и не совпадает с миграциями. Пересоздайте её: docker compose down -v && docker compose up -d',
    );
  }
  process.exitCode = 1;
} finally {
  await orm.close();
}
