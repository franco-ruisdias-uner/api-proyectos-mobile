import type { NextFunction, Request, Response } from 'express';
import { ErrorApi } from '../errores/error-api.js';
import { enviarError } from '../errores/filtro-excepciones.js';
import { interpretarSimulacion } from './reglas/simulacion.js';

/**
 * `X-Simular: error-500` responde ERROR_INTERNO; `X-Simular: demora-3000` responde 3 s tarde
 * (AGENTS §11.4). Sirve para probar en la app los errores de red y los estados de carga.
 */
export function middlewareSimulacion() {
  return (req: Request, res: Response, next: NextFunction) => {
    const simulacion = interpretarSimulacion(req.get('x-simular'));
    if (!simulacion) return next();
    if (simulacion.tipo === 'error') return enviarError(res, new ErrorApi('ERROR_INTERNO'));
    setTimeout(next, simulacion.milisegundos);
  };
}
