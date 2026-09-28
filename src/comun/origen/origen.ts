import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

/**
 * Origen del pedido en curso (`http://192.168.0.10:3000`), para armar URLs absolutas sin que
 * el mapeador reciba el request (AGENTS §8). Con `URL_PUBLICA` definida, manda esa.
 */
const almacen = new AsyncLocalStorage<{ origen: string }>();

export function middlewareOrigen(urlPublica: string | null) {
  // `req.protocol` y `req.host` respetan `trust proxy` (CONFIAR_PROXY): detrás del proxy de
  // Render salen de X-Forwarded-Proto y X-Forwarded-Host; si no, de la conexión y de Host.
  return (req: Request, _res: Response, next: NextFunction) => {
    const origen = urlPublica ?? `${req.protocol}://${req.host || 'localhost'}`;
    almacen.run({ origen }, () => next());
  };
}

export function origenActual(): string {
  return almacen.getStore()?.origen ?? 'http://localhost:3000';
}

/** Ejecuta `fn` con un origen fijo (semillas, scripts). */
export function conOrigen<T>(origen: string, fn: () => T): T {
  return almacen.run({ origen }, fn);
}
