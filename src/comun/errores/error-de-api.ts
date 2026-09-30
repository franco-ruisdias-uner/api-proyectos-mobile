import { CATALOGO, type CodigoDeError } from './catalogo.js';

/**
 * Error de negocio con un código del catálogo. El filtro global lo convierte en
 * { error: { codigo, mensaje } } con el estado HTTP del catálogo.
 */
export class ErrorDeApi extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoDeError,
    mensaje?: string,
  ) {
    super(mensaje ?? CATALOGO[codigo].mensaje);
    this.name = 'ErrorDeApi';
    this.estado = CATALOGO[codigo].estado;
  }
}
