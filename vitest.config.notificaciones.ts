import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): sólo lo de notificaciones, afuera de `pnpm verificar`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notificaciones/**/*.spec.ts', 'test/notificaciones/**/*.e2e-spec.ts'],
    setupFiles: ['test/utilidades/entorno-e2e.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
