import { defineConfig } from 'vitest/config';

// Unitarios: reglas puras y la suite de contrato del almacén de archivos.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/storage/**/*.spec.ts'],
    exclude: ['**/node_modules/**', 'docs/**', 'dist/**'],
  },
});
