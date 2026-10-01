import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): corre contra la app real, sin los dobles de push.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notificaciones/**/*.e2e-spec.ts'],
    setupFiles: ['test/utilidades/entorno-test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
