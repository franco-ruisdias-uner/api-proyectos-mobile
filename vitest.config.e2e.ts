import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Con un motor de red (matriz) todos los archivos comparten la misma base: van de a uno.
const baseCompartida = Boolean(process.env.DB_URL);

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: !baseCompartida,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
