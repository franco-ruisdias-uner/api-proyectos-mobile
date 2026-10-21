// pnpm test:e2e:matriz [motor…] — corre la suite e2e en SQLite, PostgreSQL 17, MySQL 8.4 y
// MariaDB 11 (AGENTS §10.4). Levanta las bases con compose.matriz.yaml y las baja al final.
// `--mantener` deja las bases levantadas para volver a correr más rápido.
import { spawnSync } from 'node:child_process';

const MOTORES = {
  'better-sqlite3': {},
  postgres: { DB_URL: 'postgres://api:api@127.0.0.1:55432/api' },
  mysql: { DB_URL: 'mysql://api:api@127.0.0.1:53306/api' },
  mariadb: { DB_URL: 'mysql://api:api@127.0.0.1:53307/api' },
};

const argumentos = process.argv.slice(2);
const mantener = argumentos.includes('--mantener');
const pedidos = argumentos.filter((a) => !a.startsWith('--'));
const elegidos = pedidos.length > 0 ? pedidos : Object.keys(MOTORES);
for (const m of elegidos) {
  if (!(m in MOTORES)) {
    console.error(
      `Motor desconocido: ${m}. Opciones: ${Object.keys(MOTORES).join(', ')}`,
    );
    process.exit(2);
  }
}

const correr = (comando, args, env = {}) =>
  spawnSync(comando, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  }).status;

// S3Proxy va siempre: los tests de archivos contra S3 (AGENTS §17.4) corren con cada motor.
const S3_ENDPOINT_PRUEBA = 'http://127.0.0.1:58080';
const deRed = elegidos.filter((m) => m !== 'better-sqlite3');
const compose = ['compose', '-f', 'compose.matriz.yaml'];
{
  const servicios = [...deRed, 's3'];
  console.log(`\n▶ Levantando ${servicios.join(', ')} con Docker…`);
  if (
    correr('docker', [...compose, 'up', '-d', '--wait', ...servicios]) !== 0
  ) {
    console.error('No se pudieron levantar las bases. ¿Está Docker andando?');
    process.exit(1);
  }
}

const resultados = {};
try {
  for (const motor of elegidos) {
    console.log(`\n▶ E2E con ${motor}`);
    resultados[motor] =
      correr(
        'pnpm',
        ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'],
        {
          DB_MOTOR: motor,
          DB_URL: MOTORES[motor].DB_URL ?? '',
          S3_ENDPOINT_PRUEBA,
        },
      ) === 0;
  }
} finally {
  if (!mantener) correr('docker', [...compose, 'down', '-v']);
}

console.log('\nMatriz:');
for (const [motor, ok] of Object.entries(resultados))
  console.log(`  ${ok ? '✓' : '✗'} ${motor}`);
process.exit(Object.values(resultados).every(Boolean) ? 0 : 1);
