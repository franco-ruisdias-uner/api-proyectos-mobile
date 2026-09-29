// Sobre de respuesta (AGENTS §4.1 y §4.2). Los controladores lo arman explícitamente.
import type {
  Meta,
  RespuestaLista,
  RespuestaUno,
} from '../../../contrato/api.js';

export function respuestaUno<T>(datos: T): RespuestaUno<T> {
  return { datos, meta: null };
}

export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta };
}

export interface Pagina {
  pagina: number;
  porPagina: number;
}

/** skip/take de TypeORM para una página. */
export const saltoYTamano = ({ pagina, porPagina }: Pagina) => ({
  skip: (pagina - 1) * porPagina,
  take: porPagina,
});
