import { defineConfig } from 'vitest/config';

const motor = process.env.DB_MOTOR ?? 'better-sqlite3';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // La consigna de los alumnos corre aparte (pnpm test:notificaciones, AGENTS §19.3).
    exclude: ['test/notifications/**', '**/node_modules/**'],
    setupFiles: ['test/utilities/e2e-environment.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // SQLite en memoria: una base por app, se puede en paralelo. Los otros motores comparten
    // una sola base del contenedor, así que los archivos corren de a uno.
    fileParallelism: motor === 'better-sqlite3',
  },
});
