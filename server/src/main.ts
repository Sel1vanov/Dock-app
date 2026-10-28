/** Точка входа сервера: конфигурация → ORM → проверка миграций → HTTP. */
import { loadConfig, loadEnvFile } from './core/config.js';
import { buildApp } from './app.js';
import { initOrm } from './database/orm.js';

loadEnvFile();
const config = loadConfig();
const orm = await initOrm(config);

const pending = await orm.migrator.getPending();
if (pending.length > 0) {
  console.warn(`Не применены миграции: ${pending.map((m) => m.name).join(', ')}. Выполните: npm run db:migrate`);
}

const app = await buildApp({ config, orm });

const shutdown = async () => {
  await app.close();
  await orm.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: config.HOST, port: config.PORT });
app.log.info(`Документация API: http://localhost:${config.PORT}/docs`);
