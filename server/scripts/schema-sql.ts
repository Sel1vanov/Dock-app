// Вспомогательный скрипт разработчика: показывает SQL, который ORM считает нужным выполнить,
// чтобы схема БД совпала с моделями (пусто — схема и модели совпадают).
import { initOrm } from '../src/database/orm.js';
import { loadConfig, loadEnvFile } from '../src/core/config.js';

loadEnvFile();
const config = loadConfig();
const orm = await initOrm(config);
const mode = process.argv[2] ?? 'update';
const sql = mode === 'create' ? await orm.schema.getCreateSchemaSQL() : await orm.schema.getUpdateSchemaSQL();
console.log(sql.trim() || '-- схема совпадает с моделями');
await orm.close();
