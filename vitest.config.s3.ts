import { defineConfig } from 'vitest/config';
import { ENTORNO_DE_PRUEBA } from './test/utilities/environment.js';

// Archivos contra S3 (S3Proxy de compose.matriz.yaml): sólo los corre `pnpm test:e2e:matriz`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    env: ENTORNO_DE_PRUEBA,
    include: ['test/storage-s3/**/*.spec.ts', 'test/e2e-s3/**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', 'docs/**', 'dist/**'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
