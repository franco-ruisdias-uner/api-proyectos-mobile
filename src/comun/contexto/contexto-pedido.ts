import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

interface ContextoPedido {
  /** "http://192.168.0.10:3000": la dirección que usó el teléfono para llegar. */
  origen: string;
}

const almacen = new AsyncLocalStorage<ContextoPedido>();

/**
 * Guarda el origen de cada pedido (AGENTS §8) para que el mapeador arme URLs absolutas sin
 * recibir el request. Con URL_PUBLICA definida, gana ésa. Con CONFIAR_PROXY=true, Express
 * toma el protocolo y el host de X-Forwarded-Proto / X-Forwarded-Host (`trust proxy`).
 */
export function middlewareContexto(urlPublica: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origen = urlPublica ?? `${req.protocol}://${req.host}`;
    almacen.run({ origen }, () => next());
  };
}

/** Origen del pedido en curso. Fuera de un pedido (semillas, tareas), el local por defecto. */
export function origenActual(): string {
  return almacen.getStore()?.origen ?? 'http://localhost:3000';
}

/** Corre `fn` como si fuera un pedido con ese origen (semillas, tests). */
export function conOrigen<T>(origen: string, fn: () => T): T {
  return almacen.run({ origen }, fn);
}
