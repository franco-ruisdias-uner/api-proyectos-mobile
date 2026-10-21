// Tabla de errores del README, generada del catálogo (AGENTS §13).
import { CATALOGO } from '../../src/common/errors/catalog.js';

export function tablaDeErrores(): string {
  const filas = Object.entries(CATALOGO)
    .sort(([a, x], [b, y]) => x.estado - y.estado || a.localeCompare(b))
    .map(
      ([codigo, { estado, mensaje }]) =>
        `| \`${codigo}\` | ${estado} | ${mensaje} |`,
    );
  return ['| Código | HTTP | Mensaje |', '|---|---|---|', ...filas].join('\n');
}
