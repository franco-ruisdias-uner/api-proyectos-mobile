// `pnpm test:e2e:matriz`: la misma suite e2e en los cuatro motores (AGENTS §10.4).
// Levanta las bases de compose.matriz.yaml, corre y las baja siempre.
// Con --solo-sqlite (o sin Docker) corre sólo SQLite y lo dice.
import { spawnSync } from 'node:child_process';

const COMPOSE = ['compose', '-f', 'compose.matriz.yaml'];
const MOTORES = [
  { motor: 'postgres', url: 'postgres://api:api@127.0.0.1:55432/api' },
  { motor: 'mysql', url: 'mysql://api:api@127.0.0.1:53306/api' },
  { motor: 'mariadb', url: 'mysql://api:api@127.0.0.1:53307/api' },
];

function correr(comando, argumentos, entorno = {}) {
  const r = spawnSync(comando, argumentos, {
    stdio: 'inherit',
    env: { ...process.env, ...entorno },
  });
  return r.status === 0;
}

// S3Proxy de compose.matriz.yaml: los tests de archivos lo usan si está esta variable.
const S3 = 'http://127.0.0.1:58080';

function e2e(motor, url, s3 = false) {
  console.log(`\n=== E2E con ${motor} ===`);
  const entorno = {
    DB_MOTOR: motor,
    ...(url ? { DB_URL: url } : {}),
    ...(s3 ? { S3_PRUEBAS_ENDPOINT: S3 } : {}),
  };
  return correr(
    'pnpm',
    ['exec', 'vitest', 'run', '--config', './vitest.config.e2e.ts'],
    entorno,
  );
}

const resultados = { 'better-sqlite3': e2e('better-sqlite3') };

const hayDocker =
  !process.argv.includes('--solo-sqlite') &&
  spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
if (hayDocker) {
  try {
    if (!correr('docker', [...COMPOSE, 'up', '-d', '--wait']))
      throw new Error('No se pudieron levantar las bases.');
    console.log('\n=== Archivos contra S3Proxy ===');
    resultados['s3proxy'] = correr(
      'pnpm',
      ['exec', 'vitest', 'run', 'test/almacen/almacen-s3.spec.ts'],
      { S3_PRUEBAS_ENDPOINT: S3 },
    );
    for (const { motor, url } of MOTORES)
      resultados[motor] = e2e(motor, url, motor === 'postgres');
  } finally {
    correr('docker', [...COMPOSE, 'down', '-v']);
  }
}

console.log('\n=== Matriz ===');
for (const [motor, ok] of Object.entries(resultados))
  console.log(`${ok ? '✓' : '✗'} ${motor}`);
if (!hayDocker)
  console.log('Sin Docker: sólo se probó SQLite (la CI corre los otros tres).');
process.exit(Object.values(resultados).every(Boolean) ? 0 : 1);
