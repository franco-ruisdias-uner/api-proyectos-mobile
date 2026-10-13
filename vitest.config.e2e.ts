import { defineConfig } from 'vitest/config';

// E2E: la app completa contra una base real. Con SQLite en memoria cada archivo tiene su
// base y corren en paralelo; contra PostgreSQL/MySQL/MariaDB comparten base y van de a uno.
const motor = process.env.DB_MOTOR ?? 'better-sqlite3';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts', 'test/verificacion/**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', 'docs/**', 'dist/**'],
    // De a un archivo: en paralelo, con la máquina cargada (scrypt + SQLite), los hooks vencían por timeout;
    // en serie la suite entera tarda menos de un minuto.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
