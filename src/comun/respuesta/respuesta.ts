import type { Meta, RespuestaLista, RespuestaUno } from '../../../contrato/api.js';

export function respuestaUno<T>(dato: T): RespuestaUno<T> {
  return { datos: dato, meta: null };
}

export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta };
}
