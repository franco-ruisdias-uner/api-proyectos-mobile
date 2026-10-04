// Simulación de fallas (AGENTS §11.4): con SIMULACION_HABILITADA=true, la cabecera
// X-Simular: error-500 devuelve ERROR_INTERNO y X-Simular: demora-3000 tarda 3 s.
import type { NextFunction, Request, Response } from 'express';
import { traducirExcepcion } from '../errores/filtro-excepciones.js';
import { ErrorApi } from '../errores/error-api.js';

export const DEMORA_MAXIMA_MS = 30_000;

export type Simulacion =
  { tipo: 'error' } | { tipo: 'demora'; ms: number } | null;

/** Lee la cabecera. Lo que no se entiende se ignora. */
export function leerSimulacion(cabecera: string | undefined): Simulacion {
  const valor = cabecera?.trim().toLowerCase();
  if (!valor) return null;
  if (valor === 'error-500') return { tipo: 'error' };
  const m = /^demora-(\d{1,6})$/.exec(valor);
  if (m)
    return { tipo: 'demora', ms: Math.min(Number(m[1]), DEMORA_MAXIMA_MS) };
  return null;
}

/** Middleware de Express: va antes de las rutas, así funciona también en endpoints con sesión. */
export function middlewareSimulacion() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const simulacion = leerSimulacion(req.get('x-simular'));
    if (!simulacion) return next();
    if (simulacion.tipo === 'error') {
      const { estado, cuerpo } = traducirExcepcion(
        new ErrorApi('ERROR_INTERNO'),
      );
      res.status(estado).json(cuerpo);
      return;
    }
    setTimeout(next, simulacion.ms);
  };
}
