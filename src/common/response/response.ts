import type { Meta, RespuestaLista, RespuestaUno } from '../../../contract/api.js';

/** `{ datos: [...], meta: { total, pagina, porPagina } }` */
export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta };
}

/** `{ datos: {...}, meta: null }` */
export function respuestaUno<T>(dato: T): RespuestaUno<T> {
  return { datos: dato, meta: null };
}
