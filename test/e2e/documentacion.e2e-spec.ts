import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SwaggerModule } from '@nestjs/swagger';
import { documentoSwagger } from '../../src/aplicacion.js';
import { CATALOGO } from '../../src/comun/errores/catalogo.js';
import { actualizarReadme } from '../../src/documentacion/readme.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

function archivosDe(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : ruta.endsWith('.ts') ? [ruta] : [];
  });
}

describe('AGENTS §13 — README al día', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('las tablas de endpoints y errores coinciden con Swagger y el catálogo (si falla: pnpm docs:readme)', () => {
    const readme = readFileSync('README.md', 'utf8');
    const documento = SwaggerModule.createDocument(ctx.app, documentoSwagger());
    expect(actualizarReadme(readme, documento)).toBe(readme);
  });
});

describe('AGENTS §10 — cada código de error del catálogo tiene un test que lo pide', () => {
  const texto = archivosDe('test')
    .map((archivo) => readFileSync(archivo, 'utf8'))
    .join('\n');

  it.each(Object.keys(CATALOGO))('%s', (codigo) => {
    expect(texto).toMatch(new RegExp(`esperarError\\([\\s\\S]{0,300}?'${codigo}'`));
  });
});
