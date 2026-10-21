// Máquina de estados de un reporte (R11, D3) y reglas de la bandeja. Funciones puras.
import type { EstadoReporte } from '../../../../contract/types.js';

export type ResultadoTransicion =
  'ok' | 'TRANSICION_INVALIDA' | 'CUADRILLA_REQUERIDA';

/** A qué estados se puede pasar con `PATCH /estado` (`asignado` va por `/cuadrilla`). */
const DESTINOS_POR_ESTADO: Record<EstadoReporte, readonly EstadoReporte[]> = {
  recibido: ['en_revision', 'rechazado'],
  en_revision: ['rechazado'],
  asignado: ['resuelto', 'en_revision', 'rechazado'],
  resuelto: [],
  rechazado: [],
};

/** Los estados desde los que se puede asignar o reasignar una cuadrilla. */
const ASIGNABLES: readonly EstadoReporte[] = ['en_revision', 'asignado'];

export function transicionPorEstado(
  desde: EstadoReporte,
  hasta: EstadoReporte,
): ResultadoTransicion {
  if (hasta === 'asignado') return 'CUADRILLA_REQUERIDA';
  return DESTINOS_POR_ESTADO[desde].includes(hasta)
    ? 'ok'
    : 'TRANSICION_INVALIDA';
}

export function transicionPorCuadrilla(
  desde: EstadoReporte,
): 'ok' | 'TRANSICION_INVALIDA' {
  return ASIGNABLES.includes(desde) ? 'ok' : 'TRANSICION_INVALIDA';
}

export const TOPE_FOTOS_DEL_ARREGLO = 3;

export const admiteFotoDelArreglo = (estado: EstadoReporte): boolean =>
  estado === 'asignado' || estado === 'resuelto';

export const comentarioDeDuplicado = (codigoDelOriginal: string): string =>
  `Duplicado de ${codigoDelOriginal}`;
