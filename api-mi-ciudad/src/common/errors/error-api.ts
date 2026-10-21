import { CATALOGO_ERRORES, type CodigoError } from './catalog.js';

/** Error de negocio: el filtro global lo convierte en `{ error: { codigo, mensaje } }`. */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
    causa?: unknown,
  ) {
    super(mensaje ?? CATALOGO_ERRORES[codigo].mensaje, causa === undefined ? undefined : { cause: causa });
    this.estado = CATALOGO_ERRORES[codigo].estado;
  }
}
