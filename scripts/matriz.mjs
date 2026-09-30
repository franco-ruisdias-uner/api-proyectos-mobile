// pnpm test:e2e:matriz — la misma suite e2e en SQLite, PostgreSQL 17, MySQL 8.4 y
// MariaDB 11 (AGENTS §10.4). Levanta las bases con compose.matriz.yaml y las baja al final.
// Con MATRIZ_SIN_DOCKER=1 usa bases ya levantadas (la CI las da como service containers).
import { spawnSync } from 'node:child_process';

const MOTORES = [
  { motor: 'better-sqlite3' },
  { motor: 'postgres', url: 'postgres://api:api@127.0.0.1:55432/api' },
  { motor: 'mysql', url: 'mysql://api:api@127.0.0.1:53306/api' },
  { motor: 'mariadb', url: 'mysql://api:api@127.0.0.1:53307/api' },
];

const pedidos = process.argv.slice(2);
const elegidos = pedidos.length ? MOTORES.filter((m) => pedidos.includes(m.motor)) : MOTORES;
const conDocker = !process.env.MATRIZ_SIN_DOCKER;
const compose = ['compose', '-f', 'compose.matriz.yaml'];

const correr = (comando, argumentos, env = process.env) =>
  spawnSync(comando, argumentos, { stdio: 'inherit', env, shell: process.platform === 'win32' })
    .status ?? 1;

const servidores = elegidos.filter((m) => m.url).map((m) => m.motor);
if (conDocker && servidores.length) {
  if (correr('docker', [...compose, 'up', '-d', '--wait', ...servidores]) !== 0) {
    console.error('No se pudieron levantar las bases con Docker.');
    process.exit(1);
  }
}

const resultados = [];
try {
  for (const { motor, url } of elegidos) {
    console.log(`\n━━━ e2e contra ${motor} ━━━`);
    const env = { ...process.env, DB_MOTOR: motor };
    if (url) env.DB_URL = url;
    else delete env.DB_URL;
    resultados.push({ motor, ok: correr('pnpm', ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'], env) === 0 });
  }
} finally {
  if (conDocker && servidores.length) correr('docker', [...compose, 'down', '-v']);
}

console.log('\nMatriz: ' + resultados.map((r) => `${r.motor} ${r.ok ? '✓' : '✗'}`).join(' · '));
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
