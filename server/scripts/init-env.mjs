// Создаёт server/.env из .env.example, подставляя случайные секреты. Существующий .env не трогает.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dir = resolve(import.meta.dirname, '..');
const target = resolve(dir, '.env');
if (existsSync(target)) {
  console.log('server/.env уже существует — оставляю без изменений');
  process.exit(0);
}
const secret = () => randomBytes(48).toString('base64url');
const content = readFileSync(resolve(dir, '.env.example'), 'utf8')
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret()}`)
  .replace(/^FILE_URL_SECRET=.*$/m, `FILE_URL_SECRET=${secret()}`);
writeFileSync(target, content);
console.log('Создан server/.env со случайными секретами. Проверьте DATABASE_URL.');
