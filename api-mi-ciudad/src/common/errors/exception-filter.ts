import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CATALOGO_ERRORES, type CodigoError } from './catalog.js';
import { ErrorApi } from './error-api.js';

const POR_ESTADO: Record<number, CodigoError> = {
  400: 'VALIDACION_FALLIDA',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'RUTA_NO_ENCONTRADA',
  405: 'RUTA_NO_ENCONTRADA',
  413: 'PEDIDO_DEMASIADO_GRANDE',
  415: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
};

/**
 * Rutas donde un `%` roto en la dirección (Express no lo puede decodificar y Nest lo convierte
 * en un 400) tiene un código
 * propio en vez de `VALIDACION_FALLIDA`. R6: un QR ilegible es un QR que no es nuestro.
 */
const ILEGIBLE_POR_RUTA: [prefijo: string, codigo: CodigoError][] = [['/lugares/qr/', 'QR_NO_RECONOCIDO']];

/**
 * Toda respuesta de error sale como `{ error: { codigo, mensaje } }` y nada más: errores de
 * negocio, de Nest, de validación, de la base o inesperados (AGENTS §4.1 y §4.6).
 */
@Catch()
export class FiltroExcepciones implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { estado, codigo, mensaje } = this.traducir(excepcion, req);
    if (estado >= 500) {
      this.log.error(
        `${req.method} ${req.originalUrl} → ${codigo}`,
        excepcion instanceof Error ? excepcion.stack : String(excepcion),
      );
    }
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(estado).json({ error: { codigo, mensaje } });
  }

  private traducir(excepcion: unknown, req: Request): { estado: number; codigo: string; mensaje: string } {
    if (excepcion instanceof ErrorApi) {
      return { estado: excepcion.estado, codigo: excepcion.codigo, mensaje: excepcion.message };
    }
    if (excepcion instanceof HttpException) {
      const estado = excepcion.getStatus();
      let codigo: CodigoError =
        POR_ESTADO[estado] ?? (estado >= 500 ? 'ERROR_INTERNO' : 'VALIDACION_FALLIDA');
      if (estado === 413 && req.is('multipart/form-data')) codigo = 'ARCHIVO_DEMASIADO_GRANDE';
      const detalle = excepcion.getResponse();
      if (estado === 400 && typeof detalle === 'object' && detalle !== null) {
        const texto = String((detalle as { message?: unknown }).message ?? '');
        if (/unexpected field|multipart/i.test(texto)) {
          return { estado, codigo, mensaje: 'Falta el archivo: mandalo en el campo «archivo».' };
        }
        const ilegible = texto.startsWith('Failed to decode param')
          ? ILEGIBLE_POR_RUTA.find(([prefijo]) => req.path.startsWith(prefijo))?.[1]
          : undefined;
        if (ilegible) {
          const { estado: e, mensaje } = CATALOGO_ERRORES[ilegible];
          return { estado: e, codigo: ilegible, mensaje };
        }
        if (/json/i.test(texto)) {
          return { estado, codigo, mensaje: 'El cuerpo del pedido no es un JSON válido.' };
        }
      }
      return { estado: estado >= 500 ? 500 : estado, codigo, mensaje: CATALOGO_ERRORES[codigo].mensaje };
    }
    // Errores de Express que no pasan por Nest (body-parser): traen `status` o `statusCode`.
    const conEstado = excepcion as { status?: number; type?: string };
    if (typeof conEstado?.status === 'number' && conEstado.status >= 400 && conEstado.status < 500) {
      if (conEstado.type === 'entity.parse.failed') {
        return {
          estado: 400,
          codigo: 'VALIDACION_FALLIDA',
          mensaje: 'El cuerpo del pedido no es un JSON válido.',
        };
      }
      const codigo = POR_ESTADO[conEstado.status] ?? 'VALIDACION_FALLIDA';
      return { estado: CATALOGO_ERRORES[codigo].estado, codigo, mensaje: CATALOGO_ERRORES[codigo].mensaje };
    }
    return { estado: 500, codigo: 'ERROR_INTERNO', mensaje: CATALOGO_ERRORES.ERROR_INTERNO.mensaje };
  }
}
