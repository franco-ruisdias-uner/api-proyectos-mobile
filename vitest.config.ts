import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/almacen/**/*.spec.ts', 'test/integracion/**/*.spec.ts'],
  },
});
