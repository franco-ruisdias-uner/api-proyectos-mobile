import type { NextFunction, Request, Response } from 'express';
import { CATALOGO } from '../errores/catalogo.js';

const DEMORA_MAXIMA = 30_000;

/**
 * Cabecera `X-Simular` para que los alumnos prueben errores y demoras sin apagar el wifi:
 * `error-500` responde ERROR_INTERNO; `demora-3000` responde 3 segundos tarde.
 */
export function middlewareSimulacion(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const pedido = req.get('x-simular')?.trim().toLowerCase();
  if (!pedido) return next();
  if (pedido === 'error-500') {
    res.status(500).json({
      error: {
        codigo: 'ERROR_INTERNO',
        mensaje: CATALOGO.ERROR_INTERNO.mensaje,
      },
    });
    return;
  }
  const demora = /^demora-(\d{1,6})$/.exec(pedido);
  if (demora) {
    setTimeout(next, Math.min(Number(demora[1]), DEMORA_MAXIMA));
    return;
  }
  next();
}
