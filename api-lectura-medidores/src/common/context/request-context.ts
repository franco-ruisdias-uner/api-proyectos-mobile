import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

// Guarda por pedido la dirección que usó el teléfono para llegar (protocolo + Host),
// así el mapeador arma URLs absolutas sin recibir el request (AGENTS §8).

const almacen = new AsyncLocalStorage<{ origen: string }>();

export function middlewareOrigen(
  urlPublica: string | null,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    const origen = urlPublica ?? `${req.protocol}://${req.host || 'localhost'}`;
    almacen.run({ origen }, () => next());
  };
}

/** Origen del pedido en curso ("http://192.168.0.10:3000"). */
export function origenActual(): string {
  return almacen.getStore()?.origen ?? 'http://localhost:3000';
}
