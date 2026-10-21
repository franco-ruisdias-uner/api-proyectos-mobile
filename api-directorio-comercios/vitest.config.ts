import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/storage/**/*.spec.ts', 'test/integration/**/*.spec.ts'],
  },
});
