#!/usr/bin/env node
// pnpm test:e2e:matriz — la misma suite e2e contra SQLite, PostgreSQL 17, MySQL 8.4 y
// MariaDB 11 (AGENTS §10.4). Las bases salen de compose.matriz.yaml.
// Uso: pnpm test:e2e:matriz [sqlite] [postgres] [mysql] [mariadb]   (sin argumentos: los cuatro)
import { spawnSync } from 'node:child_process';

const MOTORES = {
  sqlite: { DB_MOTOR: 'better-sqlite3' },
  postgres: { DB_MOTOR: 'postgres', DB_URL: 'postgres://api:api@127.0.0.1:55432/api', servicio: 'postgres' },
  mysql: { DB_MOTOR: 'mysql', DB_URL: 'mysql://api:api@127.0.0.1:53306/api', servicio: 'mysql' },
  mariadb: { DB_MOTOR: 'mariadb', DB_URL: 'mysql://api:api@127.0.0.1:53307/api', servicio: 'mariadb' },
};

const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const elegidos = pedidos.length > 0 ? pedidos : Object.keys(MOTORES);
for (const m of elegidos) {
  if (!MOTORES[m]) {
    console.error(`Motor desconocido: ${m}. Opciones: ${Object.keys(MOTORES).join(', ')}`);
    process.exit(2);
  }
}

const correr = (cmd, args, env = {}) =>
  spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;

const servicios = elegidos.map((m) => MOTORES[m].servicio).filter(Boolean);
// En la CI las bases ya vienen como service containers: MATRIZ_SIN_DOCKER=1.
const usarDocker = servicios.length > 0 && !process.env.MATRIZ_SIN_DOCKER;
if (usarDocker) {
  if (correr('docker', ['info'], {}) !== 0) {
    console.error('\nNo hay Docker disponible: la matriz necesita Docker para levantar las bases.');
    console.error('Podés correr sólo SQLite con: pnpm test:e2e:matriz sqlite\n');
    process.exit(1);
  }
  if (correr('docker', ['compose', '-f', 'compose.matriz.yaml', 'up', '-d', '--wait', ...servicios]) !== 0) {
    process.exit(1);
  }
}

const resultados = {};
try {
  for (const m of elegidos) {
    const { servicio: _s, ...env } = MOTORES[m];
    console.log(`\n━━━ E2E contra ${m} ━━━\n`);
    resultados[m] = correr('pnpm', ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'], env) === 0;
  }
} finally {
  if (usarDocker && !process.env.MATRIZ_DEJAR_ARRIBA) {
    correr('docker', ['compose', '-f', 'compose.matriz.yaml', 'down', '-v']);
  }
}

console.log('\nMatriz: ' + elegidos.map((m) => `${m} ${resultados[m] ? '✓' : '✗'}`).join(' · '));
process.exit(Object.values(resultados).every(Boolean) ? 0 : 1);
