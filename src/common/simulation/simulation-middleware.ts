import type { NextFunction, Request, Response } from 'express';
import { CATALOGO_ERRORES } from '../errors/catalog.js';
import { leerSimulacion } from './simulation.js';

/**
 * `X-Simular: error-500` o `X-Simular: demora-3000` (AGENTS §11.4), para que los alumnos
 * prueben los estados de error y de carga sin apagar el wifi. Sólo con `SIMULACION_HABILITADA`.
 */
export function middlewareSimulacion(req: Request, res: Response, next: NextFunction): void {
  const simulacion = leerSimulacion(req.get('x-simular'));
  if (!simulacion) return next();
  if (simulacion.tipo === 'error') {
    res
      .status(500)
      .json({ error: { codigo: 'ERROR_INTERNO', mensaje: CATALOGO_ERRORES.ERROR_INTERNO.mensaje } });
    return;
  }
  setTimeout(next, simulacion.milisegundos);
}
