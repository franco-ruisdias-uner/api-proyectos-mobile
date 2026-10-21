import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): sólo lo de notificaciones, afuera de `pnpm verificar`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notifications/**/*.spec.ts', 'test/notifications/**/*.e2e-spec.ts'],
    setupFiles: ['test/utilities/e2e-environment.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
