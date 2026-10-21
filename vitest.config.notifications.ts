import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): corre contra la app real, sin los dobles de push.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notifications/**/*.e2e-spec.ts'],
    setupFiles: ['test/utilities/e2e-environment.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
