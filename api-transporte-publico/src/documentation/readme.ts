import type { OpenAPIObject } from '@nestjs/swagger';
import { CATALOGO } from '../common/errors/catalog.js';

// Las tablas del README que no se escriben a mano (AGENTS §13): los endpoints salen del
// documento de Swagger y los errores, del catálogo.

const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Operacion {
  summary?: string;
  'x-acceso'?: string;
  'x-roles'?: string[];
}

export function tablaDeEndpoints(documento: OpenAPIObject): string {
  const filas: string[] = [];
  const rutas = Object.entries(documento.paths).filter(([ruta]) => !ruta.startsWith('/docs'));
  for (const [ruta, item] of rutas) {
    for (const metodo of METODOS) {
      const operacion = (item as Record<string, Operacion | undefined>)[metodo];
      if (!operacion) continue;
      const acceso = operacion['x-roles']
        ? `🛠 ${operacion['x-roles'].join(', ')}`
        : operacion['x-acceso'] === 'publico'
          ? '🌐 público'
          : '🔒 con sesión';
      const rutaLegible = ruta.replace(/\{(\w+)\}/g, ':$1');
      filas.push(
        `| \`${metodo.toUpperCase()}\` | \`${rutaLegible}\` | ${acceso} | ${operacion.summary ?? ''} |`,
      );
    }
  }
  return ['| Método | Ruta | Acceso | Qué hace |', '|---|---|---|---|', ...filas].join('\n');
}

export function tablaDeErrores(): string {
  const filas = Object.entries(CATALOGO)
    .sort(([a, x], [b, y]) => x.estado - y.estado || a.localeCompare(b))
    .map(([codigo, { estado, mensaje }]) => `| \`${codigo}\` | ${estado} | ${mensaje} |`);
  return ['| Código | HTTP | Mensaje |', '|---|---|---|', ...filas].join('\n');
}

/** Reemplaza lo que hay entre <!-- nombre:inicio --> y <!-- nombre:fin -->. */
export function reemplazarSeccion(texto: string, nombre: string, contenido: string): string {
  const inicio = `<!-- ${nombre}:inicio -->`;
  const fin = `<!-- ${nombre}:fin -->`;
  const desde = texto.indexOf(inicio);
  const hasta = texto.indexOf(fin);
  if (desde === -1 || hasta === -1 || hasta < desde) {
    throw new Error(`El README no tiene las marcas ${inicio} … ${fin}`);
  }
  return `${texto.slice(0, desde + inicio.length)}\n${contenido}\n${texto.slice(hasta)}`;
}

export function actualizarReadme(texto: string, documento: OpenAPIObject): string {
  return reemplazarSeccion(
    reemplazarSeccion(texto, 'endpoints', tablaDeEndpoints(documento)),
    'errores',
    tablaDeErrores(),
  );
}
