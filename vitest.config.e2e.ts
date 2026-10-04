import { defineConfig } from 'vitest/config';

// Contra SQLite en memoria cada archivo tiene su base y corren en paralelo. Contra un
// servidor (matriz), comparten la base: van de a uno.
const contraServidor = (process.env.DB_MOTOR ?? 'better-sqlite3') !== 'better-sqlite3';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: !contraServidor,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
