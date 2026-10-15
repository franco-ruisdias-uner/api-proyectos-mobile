// `pnpm test:e2e:matriz`: la misma suite e2e contra SQLite, PostgreSQL 17, MySQL 8.4 y
// MariaDB 11 (levantados con compose.matriz.yaml). Sin dependencias.
// Uso: node scripts/matriz.mjs [motor ...]   (por defecto, los cuatro)
// Con MATRIZ_SIN_DOCKER=1 no levanta ni baja contenedores (la CI usa service containers).
import { spawnSync } from 'node:child_process';

const MOTORES = {
  'better-sqlite3': {},
  postgres: {
    DB_URL:
      process.env.MATRIZ_URL_POSTGRES ??
      'postgres://api:api@127.0.0.1:55432/api',
  },
  mysql: {
    DB_URL:
      process.env.MATRIZ_URL_MYSQL ?? 'mysql://root:api@127.0.0.1:53306/api',
  },
  mariadb: {
    DB_URL:
      process.env.MATRIZ_URL_MARIADB ?? 'mysql://root:api@127.0.0.1:53307/api',
  },
};

const pedidos = process.argv.slice(2);
const motores = pedidos.length > 0 ? pedidos : Object.keys(MOTORES);
for (const m of motores) {
  if (!(m in MOTORES)) {
    console.error(
      `Motor desconocido: ${m}. Opciones: ${Object.keys(MOTORES).join(', ')}`,
    );
    process.exit(2);
  }
}

const conDocker = !process.env.MATRIZ_SIN_DOCKER;
const compose = (...args) =>
  spawnSync('docker', ['compose', '-f', 'compose.matriz.yaml', ...args], {
    stdio: 'inherit',
  });

const resultados = {};
try {
  if (conDocker) {
    const servicios = ['s3', ...motores.filter((m) => m !== 'better-sqlite3')];
    console.log(`\n▶ Levantando ${servicios.join(', ')}…`);
    if (compose('up', '-d', '--wait', ...servicios).status !== 0) {
      throw new Error('No se pudieron levantar las bases con Docker.');
    }
  }
  for (const motor of motores) {
    console.log(`\n▶ E2E con ${motor}`);
    const r = spawnSync(
      'pnpm',
      ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'],
      {
        stdio: 'inherit',
        env: { ...process.env, DB_ENGINE: motor, ...MOTORES[motor] },
      },
    );
    resultados[motor] = r.status === 0;
  }
  // Archivos: la suite de contrato del almacén y los e2e, contra S3 (S3Proxy)
  console.log('\n▶ Archivos con S3 (S3Proxy)');
  const s3 = spawnSync(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', './vitest.config.s3.ts'],
    {
      stdio: 'inherit',
      env: { ...process.env, DB_ENGINE: 'better-sqlite3', DB_URL: '' },
    },
  );
  resultados['archivos-s3'] = s3.status === 0;
} finally {
  if (conDocker) compose('down', '-v');
}

console.log('\nMatriz de motores:');
for (const [motor, ok] of Object.entries(resultados))
  console.log(`  ${ok ? '✓' : '✗'} ${motor}`);
process.exit(
  Object.values(resultados).every(Boolean) &&
    Object.keys(resultados).length === motores.length + 1
    ? 0
    : 1,
);
