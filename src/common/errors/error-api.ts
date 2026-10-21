import { CATALOGO, type CodigoError } from './catalog.js';

/**
 * Error de negocio con un código del catálogo. El filtro global lo convierte en
 * { error: { codigo, mensaje } } con el estado HTTP del catálogo.
 */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    /** Mensaje más preciso que el del catálogo (por ejemplo, el campo que falló). */
    mensaje?: string,
  ) {
    super(mensaje ?? CATALOGO[codigo].mensaje);
    this.estado = CATALOGO[codigo].estado;
  }
}
