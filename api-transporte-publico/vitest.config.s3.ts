import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Los tests que necesitan un servidor S3 (S3Proxy, de compose.matriz.yaml): sólo en la matriz.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.s3-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { ENTORNO: 'test', JWT_SECRETO: 'secreto-de-los-tests', DB_MOTOR: 'better-sqlite3' },
  },
});
