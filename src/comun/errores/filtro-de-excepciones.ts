import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RespuestaError } from '../../../contrato/api.js';
import { CATALOGO, type CodigoDeError } from './catalogo.js';
import { ErrorDeApi } from './error-de-api.js';

const CODIGO_POR_ESTADO: Record<number, CodigoDeError> = {
  400: 'VALIDACION_FALLIDA',
  401: 'NO_AUTENTICADO',
  403: 'SIN_PERMISO',
  404: 'RUTA_NO_ENCONTRADA',
  413: 'ARCHIVO_DEMASIADO_GRANDE',
  415: 'TIPO_DE_ARCHIVO_NO_PERMITIDO',
  416: 'RANGO_NO_VALIDO',
};

/** Mensajes para errores que no son de negocio pero sí del cliente. */
const MENSAJE_POR_TIPO: Record<string, string> = {
  'entity.parse.failed': 'Lo que mandaste no es un JSON válido.',
  'entity.too.large': 'Lo que mandaste es demasiado grande.',
  'encoding.unsupported': 'No entendemos la codificación de lo que mandaste.',
  'charset.unsupported': 'No entendemos la codificación de lo que mandaste.',
};

function estadoDeErrorExterno(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidato =
    (error as { status?: unknown; statusCode?: unknown }).status ??
    (error as { statusCode?: unknown }).statusCode;
  return typeof candidato === 'number' && candidato >= 400 && candidato < 500 ? candidato : null;
}

/** Mensaje claro para errores del cliente que no son de negocio (JSON roto, cuerpo enorme). */
function mensajeParaElCliente(excepcion: unknown): string | undefined {
  const tipo = (excepcion as { type?: unknown }).type;
  if (typeof tipo === 'string' && MENSAJE_POR_TIPO[tipo]) return MENSAJE_POR_TIPO[tipo];
  // Nest convierte el SyntaxError de body-parser en un BadRequestException con su mensaje.
  if (
    excepcion instanceof HttpException &&
    excepcion.getStatus() === 400 &&
    /JSON/.test(excepcion.message)
  ) {
    return MENSAJE_POR_TIPO['entity.parse.failed'];
  }
  return undefined;
}

/**
 * Un id o un código con un `%` suelto en la ruta ("/paradas/qr/%E0%A4%A") hace fallar a Express
 * antes de llegar al controlador. Es lo mismo que un id que no existe (DECISIONES A7): se
 * responde con el código de la entidad de esa ruta.
 */
const RUTAS_CON_PARAMETRO: [RegExp, CodigoDeError][] = [
  [/^\/paradas\/qr\//, 'QR_NO_RECONOCIDO'],
  [/^\/lineas\//, 'LINEA_NO_ENCONTRADA'],
  [/^\/paradas\//, 'PARADA_NO_ENCONTRADA'],
];

function esErrorDeDecodificacion(excepcion: unknown): boolean {
  return excepcion instanceof Error && excepcion.message.startsWith('Failed to decode param');
}

/**
 * Filtro global: toda respuesta de error sale como { error: { codigo, mensaje } }, sin
 * stack, detalles ni statusCode (AGENTS §4.1), venga de donde venga la excepción.
 */
@Catch()
export class FiltroDeExcepciones implements ExceptionFilter {
  private readonly registro = new Logger('Errores');

  catch(excepcion: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const respuesta = http.getResponse<Response>();
    const { estado, codigo, mensaje } = this.traducir(excepcion, http.getRequest<Request>());
    const cuerpo: RespuestaError = { error: { codigo, mensaje } };
    if (respuesta.headersSent) {
      respuesta.end();
      return;
    }
    respuesta.status(estado).json(cuerpo);
  }

  private traducir(
    excepcion: unknown,
    pedido: Request,
  ): { estado: number; codigo: string; mensaje: string } {
    if (esErrorDeDecodificacion(excepcion)) {
      const ruta = RUTAS_CON_PARAMETRO.find(([patron]) => patron.test(pedido.path ?? ''));
      if (ruta) {
        const [, codigo] = ruta;
        return { estado: CATALOGO[codigo].estado, codigo, mensaje: CATALOGO[codigo].mensaje };
      }
    }
    if (excepcion instanceof ErrorDeApi) {
      return { estado: excepcion.estado, codigo: excepcion.codigo, mensaje: excepcion.message };
    }

    const estado =
      excepcion instanceof HttpException ? excepcion.getStatus() : estadoDeErrorExterno(excepcion);

    if (estado !== null && estado < 500) {
      const codigo = CODIGO_POR_ESTADO[estado] ?? 'VALIDACION_FALLIDA';
      const mensaje = mensajeParaElCliente(excepcion) ?? CATALOGO[codigo].mensaje;
      return { estado, codigo, mensaje };
    }

    this.registro.error(
      excepcion instanceof Error ? (excepcion.stack ?? excepcion.message) : String(excepcion),
    );
    return { estado: 500, codigo: 'ERROR_INTERNO', mensaje: CATALOGO.ERROR_INTERNO.mensaje };
  }
}
