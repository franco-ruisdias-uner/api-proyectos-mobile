// Filtro global: toda excepción sale como { error: { codigo, mensaje } } y nada más (AGENTS §4.1).
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CATALOGO, ErrorApi, type CodigoError } from './catalogo.js';

export interface CuerpoError {
  error: { codigo: string; mensaje: string };
}

export function cuerpoError(
  codigo: CodigoError,
  mensaje?: string,
): CuerpoError {
  return { error: { codigo, mensaje: mensaje ?? CATALOGO[codigo].mensaje } };
}

/** Traduce cualquier cosa que se haya tirado a un ErrorApi. Lo desconocido es ERROR_INTERNO. */
export function traducirError(excepcion: unknown): ErrorApi {
  if (excepcion instanceof ErrorApi) return excepcion;

  if (excepcion instanceof HttpException) {
    const estado = excepcion.getStatus();
    switch (estado) {
      case 400:
        return new ErrorApi('VALIDACION_FALLIDA');
      case 401:
        return new ErrorApi('NO_AUTENTICADO');
      case 403:
        return new ErrorApi('SIN_PERMISO');
      case 404:
      case 405:
        return new ErrorApi('RUTA_NO_ENCONTRADA');
      case 413:
        return new ErrorApi('ARCHIVO_DEMASIADO_GRANDE');
      case 415:
        return new ErrorApi('TIPO_DE_ARCHIVO_NO_PERMITIDO');
      default:
        if (estado >= 400 && estado < 500)
          return new ErrorApi('VALIDACION_FALLIDA');
    }
  }

  // Errores de body-parser (JSON mal formado, cuerpo enorme) y de Express.
  const tipo = (excepcion as { type?: unknown } | null)?.type;
  const estado = (excepcion as { status?: unknown } | null)?.status;
  if (tipo === 'entity.too.large' || estado === 413)
    return new ErrorApi('ARCHIVO_DEMASIADO_GRANDE');
  if (typeof estado === 'number' && estado >= 400 && estado < 500) {
    return new ErrorApi(
      'VALIDACION_FALLIDA',
      tipo === 'entity.parse.failed'
        ? 'Los datos que mandaste no se pueden leer.'
        : undefined,
    );
  }

  return new ErrorApi('ERROR_INTERNO');
}

const logger = new Logger('Errores');

/** Escribe el error en la respuesta. Lo usan el filtro de Nest y el manejador de Express. */
export function responderError(excepcion: unknown, res: Response): void {
  const error = traducirError(excepcion);
  if (error.codigo === 'ERROR_INTERNO' && !(excepcion instanceof ErrorApi)) {
    // El detalle va sólo al log, nunca al teléfono.
    logger.error(
      excepcion instanceof Error
        ? (excepcion.stack ?? excepcion.message)
        : String(excepcion),
    );
  }
  if (res.headersSent) {
    res.end();
    return;
  }
  for (const [nombre, valor] of Object.entries(error.cabeceras))
    res.setHeader(nombre, valor);
  res.status(error.estado).json(cuerpoError(error.codigo, error.message));
}

@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(excepcion: unknown, host: ArgumentsHost): void {
    responderError(excepcion, host.switchToHttp().getResponse<Response>());
  }
}
