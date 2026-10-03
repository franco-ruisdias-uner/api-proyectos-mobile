import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO } from '../../src/comun/errores/catalogo.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';

/**
 * Las tablas de endpoints y de errores del README salen de Swagger y del catálogo
 * (AGENTS §13), no se escriben a mano. `pnpm docs:readme` las regenera; este test falla si
 * el README quedó desactualizado.
 */
const README = join(import.meta.dirname, '../../README.md');
const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Operacion {
  summary?: string;
  security?: unknown[];
}

function tablaEndpoints(paths: Record<string, Partial<Record<string, Operacion>>>): string {
  const filas = Object.entries(paths)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([ruta, ops]) =>
      METODOS.filter((m) => ops[m]).map((m) => {
        const op = ops[m]!;
        const acceso = op.security && op.security.length > 0 ? '🔒 con sesión' : '🌐 público';
        const rutaLegible = ruta.replace(/\{([^}]+)\}/g, ':$1');
        return `| \`${m.toUpperCase()}\` | \`${rutaLegible}\` | ${acceso} | ${op.summary ?? ''} |`;
      }),
    );
  return ['| Método | Ruta | Acceso | Qué hace |', '|---|---|---|---|', ...filas].join('\n');
}

function tablaErrores(): string {
  const filas = Object.entries(CATALOGO)
    .sort(([, a], [, b]) => a.estado - b.estado)
    .map(([codigo, { estado, mensaje }]) => `| ${estado} | \`${codigo}\` | ${mensaje} |`);
  return [
    '| HTTP | Código | Mensaje (se puede mostrar tal cual) |',
    '|---|---|---|',
    ...filas,
  ].join('\n');
}

function reemplazar(texto: string, marca: string, contenido: string): string {
  const inicio = `<!-- tabla:${marca} -->`;
  const fin = `<!-- /tabla:${marca} -->`;
  const i = texto.indexOf(inicio);
  const j = texto.indexOf(fin);
  if (i < 0 || j < 0) throw new Error(`Faltan las marcas ${inicio} … ${fin} en el README`);
  return `${texto.slice(0, i + inicio.length)}\n${contenido}\n${texto.slice(j)}`;
}

describe('AGENTS §13 — Las tablas del README salen de Swagger y del catálogo', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('están al día (si no: pnpm docs:readme)', async () => {
    const { body } = await t.http().get('/docs-json').expect(200);
    const actual = readFileSync(README, 'utf8');
    let esperado = reemplazar(actual, 'endpoints', tablaEndpoints(body.paths));
    esperado = reemplazar(esperado, 'errores', tablaErrores());
    if (process.env.ACTUALIZAR_README === '1') writeFileSync(README, esperado);
    else expect(actual).toBe(esperado);
  });
});
