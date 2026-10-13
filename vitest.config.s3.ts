import { defineConfig } from 'vitest/config';

// Archivos contra S3 (S3Proxy de compose.matriz.yaml): sólo los corre `pnpm test:e2e:matriz`.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/almacen-s3/**/*.spec.ts', 'test/e2e-s3/**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', 'docs/**', 'dist/**'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
