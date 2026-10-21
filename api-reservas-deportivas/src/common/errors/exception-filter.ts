// Toda respuesta de error sale como { error: { codigo, mensaje } } y nada más
// (AGENTS §4.1 y §4.6), venga de donde venga la excepción.
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CATALOGO, type CodigoError } from './catalog.js';
import { ErrorApi } from './error-api.js';

/** Excepciones de Nest/Express sin código propio → código del catálogo. */
const POR_ESTADO: Partial<Record<number, CodigoError>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDACION_FALLIDA',
  [HttpStatus.UNAUTHORIZED]: 'NO_AUTENTICADO',
  [HttpStatus.FORBIDDEN]: 'SIN_PERMISO',
  [HttpStatus.NOT_FOUND]: 'RUTA_NO_ENCONTRADA',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'RUTA_NO_ENCONTRADA',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'ARCHIVO_DEMASIADO_GRANDE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
};

export interface CuerpoError {
  error: { codigo: string; mensaje: string };
}

/** Traduce cualquier excepción a estado + sobre de error. Exportada para testearla. */
export function traducirExcepcion(excepcion: unknown): {
  estado: number;
  cuerpo: CuerpoError;
} {
  if (excepcion instanceof ErrorApi) {
    return armar(excepcion.estado, excepcion.codigo, excepcion.message);
  }
  const estado = estadoDe(excepcion);
  if (estado !== null) {
    const codigo = POR_ESTADO[estado];
    if (codigo) {
      const mensaje =
        codigo === 'VALIDACION_FALLIDA' && esErrorDeJson(excepcion)
          ? 'El cuerpo del pedido no es un JSON válido.'
          : CATALOGO[codigo].mensaje;
      return armar(CATALOGO[codigo].estado, codigo, mensaje);
    }
  }
  return armar(500, 'ERROR_INTERNO', CATALOGO.ERROR_INTERNO.mensaje);
}

@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const { estado, cuerpo } = traducirExcepcion(excepcion);
    if (estado >= 500) {
      // El detalle va sólo al log, nunca en la respuesta.
      this.logger.error(
        excepcion instanceof Error
          ? (excepcion.stack ?? excepcion.message)
          : String(excepcion),
      );
    }
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;
    res.status(estado).json(cuerpo);
  }
}

function armar(estado: number, codigo: string, mensaje: string) {
  return { estado, cuerpo: { error: { codigo, mensaje } } };
}

function estadoDe(excepcion: unknown): number | null {
  if (excepcion instanceof HttpException) return excepcion.getStatus();
  // Errores de body-parser y compañía traen `status` (o `statusCode`) numérico.
  if (excepcion !== null && typeof excepcion === 'object') {
    const e = excepcion as { status?: unknown; statusCode?: unknown };
    const estado = typeof e.status === 'number' ? e.status : e.statusCode;
    if (typeof estado === 'number' && estado >= 400 && estado < 600)
      return estado;
  }
  return null;
}

/** body-parser con un JSON roto (Nest lo convierte en BadRequestException con el mensaje de JSON.parse). */
function esErrorDeJson(excepcion: unknown): boolean {
  if (excepcion === null || typeof excepcion !== 'object') return false;
  if ((excepcion as { type?: unknown }).type === 'entity.parse.failed')
    return true;
  return excepcion instanceof HttpException && /JSON/.test(excepcion.message);
}
