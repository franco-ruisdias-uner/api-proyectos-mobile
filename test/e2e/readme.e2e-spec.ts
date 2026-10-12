import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MARCAS,
  tablaDeEndpoints,
  tablaDeErrores,
} from '../../src/documentacion/tablas.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

describe('AGENTS §13 — Las tablas del README salen del catálogo y de Swagger', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  const readme = readFileSync(
    join(import.meta.dirname, '../../README.md'),
    'utf8',
  );

  it('la tabla de errores está al día (si falla: pnpm docs:readme)', () => {
    expect(readme).toContain(
      `${MARCAS.errores[0]}\n${tablaDeErrores()}\n${MARCAS.errores[1]}`,
    );
  });

  it('la tabla de endpoints está al día (si falla: pnpm docs:readme)', async () => {
    const documento = (await c.http().get('/docs-json').expect(200)).body;
    expect(readme).toContain(
      `${MARCAS.endpoints[0]}\n${tablaDeEndpoints(documento)}\n${MARCAS.endpoints[1]}`,
    );
  });
});
