// El sobre de toda respuesta (AGENTS §4.1). Los controladores lo arman explícito.
import type {
  Meta,
  RespuestaLista,
  RespuestaUno,
} from '../../../contract/api.js';

export function respuestaUno<T>(dato: T): RespuestaUno<T> {
  return { datos: dato, meta: null };
}

export function respuestaLista<T>(datos: T[], meta: Meta): RespuestaLista<T> {
  return { datos, meta };
}
