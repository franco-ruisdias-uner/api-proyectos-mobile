import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Con SQLite cada archivo tiene su base en memoria y corren en paralelo. Contra un servidor
// (PostgreSQL, MySQL, MariaDB) comparten la base: van de a uno y cada app la vacía al arrancar.
const motor = process.env.DB_MOTOR ?? 'better-sqlite3';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: motor === 'better-sqlite3',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      ENTORNO: 'test',
      JWT_SECRETO: 'secreto-de-los-tests',
      DB_MOTOR: motor,
    },
  },
});
