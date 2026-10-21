// Estados de un reporte (funciones puras, sin Nest ni base).
import type { EstadoReporte } from '../../../../contract/types.js';

export const TODOS_LOS_ESTADOS: readonly EstadoReporte[] = [
  'recibido',
  'en_revision',
  'asignado',
  'resuelto',
  'rechazado',
];

/** Los que todavía se están trabajando (R9). */
export const ESTADOS_ABIERTOS: readonly EstadoReporte[] = [
  'recibido',
  'en_revision',
  'asignado',
];

/** D10: el mapa sin filtro de estado no muestra los rechazados. */
export const ESTADOS_DEL_MAPA_POR_DEFECTO: readonly EstadoReporte[] = [
  'recibido',
  'en_revision',
  'asignado',
  'resuelto',
];

export const esEstadoAbierto = (estado: EstadoReporte): boolean =>
  ESTADOS_ABIERTOS.includes(estado);

/**
 * `?estado=recibido,asignado` → lista sin repetidos. Devuelve `null` si algún elemento
 * está vacío o no es un estado.
 */
export function interpretarEstados(texto: string): EstadoReporte[] | null {
  const estados: EstadoReporte[] = [];
  for (const parte of texto.split(',')) {
    const estado = parte.trim() as EstadoReporte;
    if (!TODOS_LOS_ESTADOS.includes(estado)) return null;
    if (!estados.includes(estado)) estados.push(estado);
  }
  return estados;
}
