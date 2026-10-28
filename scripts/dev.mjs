// Запуск всего проекта одной командой (npm run dev):
//   1) проверяет настройки и применяет миграции, при пустой базе заливает демо-данные;
//   2) запускает сервер API в фоне (журнал — server/logs/dev.log);
//   3) запускает Expo (QR-код для телефона, «w» — браузер).
// Ctrl+C останавливает и Expo, и сервер.
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

console.log('▶ Подготовка базы данных (миграции и демо-данные)…');
const prepare = spawnSync(npm, ['run', 'prepare:db'], { cwd: server, stdio: 'inherit', shell: isWindows });
if (prepare.status !== 0) {
  fail('База не готова. Проверьте строку DATABASE_URL в файле server/.env (см. README, «Запуск»).');
}

mkdirSync(resolve(server, 'logs'), { recursive: true });
const log = openSync(resolve(server, 'logs', 'dev.log'), 'w');
console.log('▶ Запуск сервера API…');
// Сервер — один процесс node (без npm-обёртки), чтобы его можно было надёжно остановить.
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
      // ещё запускается
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
