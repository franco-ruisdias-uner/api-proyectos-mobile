import { defineConfig } from 'vitest/config';

// Contra PostgreSQL, MySQL o MariaDB todos los archivos comparten una base: van de a uno.
const motorCompartido = (process.env.DB_MOTOR ?? 'better-sqlite3') !== 'better-sqlite3';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    setupFiles: ['test/utilidades/entorno-e2e.ts'],
    fileParallelism: !motorCompartido,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
