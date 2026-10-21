import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CATALOGO_ERRORES } from '../../src/common/errors/catalog.js';
import { crearDocumentoSwagger } from '../../src/setup-app.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';

/**
 * AGENTS §13: las tablas de endpoints y de errores del README salen de Swagger y del catálogo,
 * no se escriben a mano. Para regenerarlas: `pnpm readme:tablas`.
 */
const README = join(import.meta.dirname, '../../README.md');
const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function tablaEndpoints(documento: ReturnType<typeof crearDocumentoSwagger>): string {
  const filas: string[] = [];
  for (const [ruta, operaciones] of Object.entries(documento.paths)) {
    for (const metodo of METODOS) {
      const op = operaciones[metodo];
      if (!op) continue;
      const acceso = op.security?.length ? '🔒' : '🌐';
      const rutaLegible = ruta.replace(/\{(\w+)\}/g, ':$1');
      filas.push(`| \`${metodo.toUpperCase()}\` | \`${rutaLegible}\` | ${acceso} | ${op.summary ?? ''} |`);
    }
  }
  return ['| Método | Ruta | | Qué hace |', '|---|---|---|---|', ...filas].join('\n');
}

function tablaErrores(): string {
  const filas = Object.entries(CATALOGO_ERRORES)
    .sort(([, a], [, b]) => a.estado - b.estado)
    .map(([codigo, { estado, mensaje }]) => `| ${estado} | \`${codigo}\` | ${mensaje} |`);
  return ['| HTTP | Código | Mensaje (se puede mostrar tal cual) |', '|---|---|---|', ...filas].join('\n');
}

function reemplazarBloque(texto: string, nombre: string, contenido: string): string {
  const inicio = `<!-- tabla:${nombre} -->`;
  const fin = `<!-- /tabla:${nombre} -->`;
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin);
  if (desde < 0 || hasta < desde) throw new Error(`El README no tiene las marcas ${inicio} … ${fin}`);
  return `${texto.slice(0, desde + inicio.length)}\n${contenido}\n${texto.slice(hasta)}`;
}

describe('AGENTS §13 — Las tablas del README salen de Swagger y del catálogo de errores', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('el README tiene las tablas al día', async () => {
    const actual = await readFile(README, 'utf8');
    let esperado = reemplazarBloque(actual, 'endpoints', tablaEndpoints(crearDocumentoSwagger(ctx.app)));
    esperado = reemplazarBloque(esperado, 'errores', tablaErrores());
    if (process.env.ACTUALIZAR_README === '1' && esperado !== actual) await writeFile(README, esperado);
    else expect(actual, 'Corré `pnpm readme:tablas` para regenerarlas.').toBe(esperado);
  });
});
