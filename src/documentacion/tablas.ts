import { CATALOGO } from '../comun/errores/catalogo.js';

// Tablas del README generadas del catálogo de errores y de Swagger (no se escriben a mano).

export const MARCAS = {
  endpoints: [
    '<!-- tabla-endpoints:inicio -->',
    '<!-- tabla-endpoints:fin -->',
  ],
  errores: ['<!-- tabla-errores:inicio -->', '<!-- tabla-errores:fin -->'],
} as const;

export function tablaDeErrores(): string {
  const filas = Object.entries(CATALOGO)
    .sort(([a, x], [b, y]) => x.estado - y.estado || a.localeCompare(b))
    .map(
      ([codigo, { estado, mensaje }]) =>
        `| \`${codigo}\` | ${estado} | ${mensaje} |`,
    );
  return ['| Código | HTTP | Mensaje |', '|---|---|---|', ...filas].join('\n');
}

interface Operacion {
  summary?: string;
  description?: string;
}

/** Recibe el documento OpenAPI (el de /docs-json). */
export function tablaDeEndpoints(documento: {
  paths: Record<string, Record<string, Operacion>>;
}): string {
  const filas: string[] = [];
  for (const [ruta, metodos] of Object.entries(documento.paths)) {
    for (const [metodo, op] of Object.entries(metodos)) {
      const acceso =
        /\*\*Acceso:\*\* (.+?)\.?$/m.exec(op.description ?? '')?.[1] ?? '';
      const rutaLinda = ruta.replace(/\{(\w+)\}/g, ':$1');
      filas.push(
        `| \`${metodo.toUpperCase()}\` | \`${rutaLinda}\` | ${acceso} | ${op.summary ?? ''} |`,
      );
    }
  }
  return [
    '| Método | Ruta | Acceso | Qué hace |',
    '|---|---|---|---|',
    ...filas,
  ].join('\n');
}

/** Reemplaza lo que hay entre las marcas. */
export function reemplazarEntre(
  texto: string,
  [inicio, fin]: readonly [string, string],
  contenido: string,
): string {
  const a = texto.indexOf(inicio);
  const b = texto.indexOf(fin);
  if (a === -1 || b === -1 || b < a)
    throw new Error(`Faltan las marcas ${inicio} … ${fin} en el README`);
  return `${texto.slice(0, a + inicio.length)}\n${contenido}\n${texto.slice(b)}`;
}
