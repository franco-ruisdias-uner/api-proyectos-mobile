import { CATALOGO, type CodigoError } from './catalog.js';

/** Error de negocio con un código del catálogo. El filtro global lo convierte en el sobre de error. */
export class ErrorApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
    estado?: number,
  ) {
    super(mensaje ?? CATALOGO[codigo].mensaje);
    this.estado = estado ?? CATALOGO[codigo].estado;
  }
}
