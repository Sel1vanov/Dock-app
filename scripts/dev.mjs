// npm run dev - поднимает все разом:
//   1) postgres в докере (docker-compose.yml), ждем пока оживет
//   2) миграции + демо-данные, если база пустая
//   3) сервер api в фоне, лог пишется в server/logs/dev.log
//   4) expo (qr для телефона, w - открыть в браузере)
// ctrl+c гасит и expo, и сервер
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = resolve(root, 'server');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

console.log('▶ Запуск PostgreSQL в Docker…');
const db = spawnSync('docker', ['compose', 'up', '-d', '--wait'], { cwd: root, stdio: 'inherit' });
if (db.status !== 0) {
  fail('PostgreSQL не запустился. Убедитесь, что Docker Desktop открыт, и повторите.');
}

console.log('▶ Подготовка базы данных (миграции и демо-данные)…');
const prepare = spawnSync(npm, ['run', 'prepare:db'], { cwd: server, stdio: 'inherit', shell: isWindows });
if (prepare.status !== 0) {
  fail('База не готова. Подробности — в сообщении выше (см. README, «Быстрый запуск»).');
}

mkdirSync(resolve(server, 'logs'), { recursive: true });
const log = openSync(resolve(server, 'logs', 'dev.log'), 'w');
console.log('▶ Запуск сервера API…');
// сервер запускаю напрямую через node, без npm - иначе его потом нормально не убить
const api = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
  cwd: server,
  stdio: ['ignore', log, log],
  env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'info' },
});

function stopApi() {
  if (api.exitCode === null) api.kill();
}
process.on('exit', stopApi);
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => process.exit(0));
api.on('exit', (code) => {
  if (code) console.error(`\n✖ Сервер API остановился с ошибкой. Подробности: server/logs/dev.log`);
});

async function waitForApi() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch('http://localhost:8000/api/v1/health');
      if (res.ok) return true;
    } catch {
      // еще не поднялся, ждем
    }
    if (api.exitCode !== null) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

if (!(await waitForApi())) fail('Сервер API не запустился. Подробности: server/logs/dev.log');
console.log('✔ Сервер API: http://localhost:8000  ·  документация: http://localhost:8000/docs');
console.log('▶ Запуск приложения (Expo)…\n');

const expo = spawn(isWindows ? 'npx.cmd' : 'npx', ['expo', 'start', ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  shell: isWindows,
});
expo.on('exit', (code) => process.exit(code ?? 0));
