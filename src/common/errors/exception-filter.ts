import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CATALOGO, type CodigoError } from './catalog.js';
import { ErrorApi } from './error-api.js';

const CODIGO_POR_ESTADO: Record<number, CodigoError> = {
  400: 'VALIDACION_FALLIDA',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'RUTA_NO_ENCONTRADA',
  413: 'ARCHIVO_DEMASIADO_GRANDE',
  415: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
  416: 'RANGO_NO_SATISFACIBLE',
};

/** Traduce cualquier error a `{ error: { codigo, mensaje } }`, sin otros campos (AGENTS §4.1). */
export function aErrorApi(error: unknown): ErrorApi {
  if (error instanceof ErrorApi) return error;

  if (error instanceof HttpException) {
    const codigo = CODIGO_POR_ESTADO[error.getStatus()];
    if (codigo) return new ErrorApi(codigo);
    return new ErrorApi('ERROR_INTERNO');
  }

  // Errores de Express que no pasan por Nest (cuerpo JSON roto, cuerpo demasiado grande).
  if (typeof error === 'object' && error !== null) {
    const { status, type } = error as { status?: unknown; type?: unknown };
    if (type === 'entity.parse.failed') {
      return new ErrorApi('VALIDACION_FALLIDA', 'Los datos enviados no tienen un formato válido.');
    }
    if (type === 'entity.too.large') {
      return new ErrorApi('VALIDACION_FALLIDA', 'Los datos enviados son demasiado largos.');
    }
    if (typeof status === 'number' && CODIGO_POR_ESTADO[status]) {
      return new ErrorApi(CODIGO_POR_ESTADO[status]);
    }
  }

  return new ErrorApi('ERROR_INTERNO');
}

export function enviarError(res: Response, error: ErrorApi): void {
  res.status(error.estado).json({ error: { codigo: error.codigo, mensaje: error.message } });
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const error = aErrorApi(excepcion);
    if (error.codigo === 'NO_IMPLEMENTADO') {
      // Esperado mientras los alumnos no completen su parte: una línea, sin stack.
      this.logger.warn(`${res.req.method} ${res.req.originalUrl}: ${error.codigo}`);
    } else if (error.estado >= 500) {
      this.logger.error(
        excepcion instanceof Error ? (excepcion.stack ?? excepcion.message) : String(excepcion),
      );
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    enviarError(res, error);
  }
}

export { CATALOGO };
