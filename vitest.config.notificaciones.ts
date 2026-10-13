import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): `pnpm test:notificaciones`. Queda afuera de
// `pnpm verificar`: en `main` falla hasta que programen el almacén de tokens y el enviador.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notificaciones/**/*.{spec,e2e-spec}.ts'],
    exclude: ['**/node_modules/**', 'docs/**', 'dist/**'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
