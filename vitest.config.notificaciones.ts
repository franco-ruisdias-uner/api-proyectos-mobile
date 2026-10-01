import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// La consigna de las notificaciones (AGENTS §19.3): `pnpm test:notificaciones`. Queda afuera de
// `pnpm verificar`: en `main` falla a propósito, hasta que los alumnos completan su parte.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/notificaciones/**/*.notif-spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { ENTORNO: 'test', JWT_SECRETO: 'secreto-de-los-tests' },
  },
});
