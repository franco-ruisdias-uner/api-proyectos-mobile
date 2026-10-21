import type { Meta, RespuestaLista, RespuestaUno } from '../../../contract/api.js';

/** { datos, meta: null } — un solo recurso (decisión C1). */
export function respuestaUno<T>(datos: T): RespuestaUno<T> {
  return { datos, meta: null };
}

/** { datos: [...], meta: { total, pagina, porPagina } } */
export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta: { total: meta.total, pagina: meta.pagina, porPagina: meta.porPagina } };
}

export const POR_PAGINA_POR_DEFECTO = 20;
export const POR_PAGINA_MAXIMO = 100;

export interface Pagina {
  pagina: number;
  porPagina: number;
  skip: number;
  take: number;
}

/** Traduce pagina/porPagina (ya validados por el DTO) a skip/take. */
export function paginar(pedido: { pagina?: number; porPagina?: number }): Pagina {
  const pagina = pedido.pagina ?? 1;
  const porPagina = pedido.porPagina ?? POR_PAGINA_POR_DEFECTO;
  return { pagina, porPagina, skip: (pagina - 1) * porPagina, take: porPagina };
}
