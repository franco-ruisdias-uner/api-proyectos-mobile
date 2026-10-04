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

function e2e(motor, url) {
  console.log(`\n=== E2E con ${motor} ===`);
  const entorno = { DB_MOTOR: motor, ...(url ? { DB_URL: url } : {}) };
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
    for (const { motor, url } of MOTORES) resultados[motor] = e2e(motor, url);
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
