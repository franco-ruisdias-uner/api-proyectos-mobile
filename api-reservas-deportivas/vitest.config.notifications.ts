import { defineConfig } from 'vitest/config';

// La consigna de los alumnos (AGENTS §19.3): `pnpm test:notificaciones`. Queda afuera de
// `pnpm verificar` a propósito: en `main` falla hasta que ellos programen las dos piezas.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/notifications/**/*.notifications-spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
