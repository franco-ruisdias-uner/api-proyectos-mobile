// El sobre de todas las respuestas (AGENTS §4.1).

export interface Meta {
  total: number;
  pagina: number;
  porPagina: number;
}

export interface RespuestaLista<T> {
  datos: T[];
  meta: Meta;
}

export interface RespuestaUno<T> {
  datos: T;
  meta: null;
}

export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta };
}

export function respuestaUno<T>(dato: T): RespuestaUno<T> {
  return { datos: dato, meta: null };
}
