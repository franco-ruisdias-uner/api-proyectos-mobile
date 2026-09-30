import type { NextFunction, Request, Response } from 'express';
import type { RespuestaError } from '../../../contrato/api.js';
import { CATALOGO } from '../errores/catalogo.js';
import { interpretarSimulacion } from './simulacion.js';

/**
 * X-Simular: error-500 → ERROR_INTERNO; X-Simular: demora-3000 → responde 3 s tarde
 * (AGENTS §11.4). Sólo se instala si SIMULACION_HABILITADA=true.
 */
export function middlewareDeSimulacion(
  pedido: Request,
  respuesta: Response,
  siguiente: NextFunction,
) {
  const simulacion = interpretarSimulacion(pedido.header('x-simular'));
  if (!simulacion) return siguiente();
  if (simulacion.tipo === 'error') {
    const cuerpo: RespuestaError = {
      error: { codigo: 'ERROR_INTERNO', mensaje: CATALOGO.ERROR_INTERNO.mensaje },
    };
    respuesta.status(500).json(cuerpo);
    return;
  }
  setTimeout(siguiente, simulacion.milisegundos);
}
