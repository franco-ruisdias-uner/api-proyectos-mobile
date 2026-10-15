import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CATALOGO, type CodigoError } from './catalogo.js';
import { ErrorApi } from './error-api.js';

const POR_ESTADO: Record<number, CodigoError> = {
  400: 'VALIDACION_FALLIDA',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'RECURSO_NO_ENCONTRADO',
  413: 'ARCHIVO_DEMASIADO_GRANDE',
  415: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
  429: 'DEMASIADOS_PEDIDOS',
};

const MENSAJE_400 = 'El pedido no está bien armado.';

/** Convierte cualquier excepción en `{ error: { codigo, mensaje } }` y nada más. */
export function aErrorApi(excepcion: unknown): ErrorApi {
  if (excepcion instanceof ErrorApi) return excepcion;

  let estado: number | undefined;
  if (excepcion instanceof HttpException) {
    estado = excepcion.getStatus();
  } else if (typeof excepcion === 'object' && excepcion !== null) {
    // Errores de Express o body-parser (JSON roto, cuerpo enorme): traen `status`.
    const e = excepcion as {
      status?: unknown;
      statusCode?: unknown;
      type?: unknown;
    };
    const posible = e.status ?? e.statusCode;
    if (typeof posible === 'number' && typeof e.type === 'string')
      estado = posible;
  }

  const codigo = estado === undefined ? undefined : POR_ESTADO[estado];
  if (codigo === undefined) return new ErrorApi('ERROR_INTERNO');
  if (codigo === 'VALIDACION_FALLIDA') return new ErrorApi(codigo, MENSAJE_400);
  if (
    codigo === 'ARCHIVO_DEMASIADO_GRANDE' &&
    !(excepcion instanceof HttpException)
  ) {
    return new ErrorApi(codigo, 'Lo que mandaste es demasiado grande.');
  }
  return new ErrorApi(codigo, CATALOGO[codigo].mensaje);
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();
    const error = aErrorApi(excepcion);
    if (error.estado >= 500 && error.codigo !== 'NO_IMPLEMENTADO') {
      this.log.error(
        excepcion instanceof Error
          ? (excepcion.stack ?? excepcion.message)
          : String(excepcion),
      );
    }
    if (respuesta.headersSent) {
      respuesta.end();
      return;
    }
    respuesta
      .status(error.estado)
      .json({ error: { codigo: error.codigo, mensaje: error.message } });
  }
}
