// `pnpm test:e2e:matriz`: corre la misma suite e2e contra SQLite, PostgreSQL 17, MySQL 8.4 y
// MariaDB 11 (AGENTS §10.4). Levanta las bases con compose.matriz.yaml y las baja al final.
// Sin dependencias: sólo Node.
import { spawnSync } from 'node:child_process';

const MOTORES = [
  { motor: 'better-sqlite3', url: undefined },
  { motor: 'postgres', url: 'postgres://api:api@127.0.0.1:55432/api' },
  { motor: 'mysql', url: 'mysql://api:api@127.0.0.1:53306/api' },
  { motor: 'mariadb', url: 'mysql://api:api@127.0.0.1:53307/api' },
];
const COMPOSE = ['compose', '-f', 'compose.matriz.yaml'];
const soloMotor = process.argv[2];
const mantener = process.argv.includes('--mantener');

const correr = (comando, args, env = {}) =>
  spawnSync(comando, args, { stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;

const elegidos = MOTORES.filter((m) => !soloMotor || soloMotor.startsWith('--') || m.motor === soloMotor);
const conDocker = elegidos.some((m) => m.url);

if (conDocker) {
  console.log('\n▶ Levantando las bases (docker compose -f compose.matriz.yaml up --wait)…');
  if (correr('docker', [...COMPOSE, 'up', '-d', '--wait', 'postgres', 'mysql', 'mariadb', 's3']) !== 0) {
    console.error('No se pudieron levantar las bases. ¿Está Docker corriendo?');
    process.exit(1);
  }
}

const resultados = [];
try {
  for (const { motor, url } of elegidos) {
    console.log(`\n▶ E2E con ${motor}`);
    const estado = correr('pnpm', ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'], {
      DB_MOTOR: motor,
      ...(conDocker ? { S3_PRUEBA_ENDPOINT: 'http://127.0.0.1:58080' } : {}),
      ...(url ? { DB_URL: url } : {}),
    });
    resultados.push({ motor, ok: estado === 0 });
  }
} finally {
  if (conDocker && !mantener) correr('docker', [...COMPOSE, 'down', '-v']);
}

console.log('\nMatriz de motores:');
for (const { motor, ok } of resultados) console.log(`  ${ok ? '✓' : '✗'} ${motor}`);
process.exit(resultados.every((r) => r.ok) ? 0 : 1);
