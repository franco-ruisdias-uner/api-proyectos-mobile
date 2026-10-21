// Datos del pedido en curso que necesitan los mapeadores sin recibir el request
// (AGENTS §8): el origen con el que el teléfono llegó a la API.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

interface ContextoPedido {
  origen: string;
}

const almacen = new AsyncLocalStorage<ContextoPedido>();

/** Middleware de Express: guarda el origen del pedido para todo lo que corra dentro. */
export function middlewareContextoPedido(urlPublica: string | null) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const origen = urlPublica ?? `${req.protocol}://${req.host}`;
    almacen.run({ origen: origen.replace(/\/+$/, '') }, next);
  };
}

/** Origen del pedido actual ("http://192.168.0.10:3000"), o null fuera de un pedido. */
export function origenDelPedido(): string | null {
  return almacen.getStore()?.origen ?? null;
}

/** Corre una función con un origen fijo (semillas, tests). */
export function conOrigen<T>(origen: string, fn: () => T): T {
  return almacen.run({ origen }, fn);
}
