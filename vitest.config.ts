import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/storage/**/*.spec.ts'],
    setupFiles: ['test/utilities/e2e-environment.ts'],
  },
});
