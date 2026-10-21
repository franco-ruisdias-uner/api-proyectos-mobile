import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { ErrorApi } from '../errors/error-api.js';
import { enviarError } from '../errors/exception-filter.js';

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
  return (req: Request, res: Response, next: NextFunction) => {
    const origen = urlPublica ?? origenDelPedido(req);
    if (origen === null) {
      // Un Host que no es una dirección terminaría adentro de las URLs de las fotos.
      return enviarError(
        res,
        new ErrorApi('VALIDACION_FALLIDA', 'La dirección a la que se hizo el pedido no es válida.'),
      );
    }
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

const HOST_VALIDO = /^(\[[0-9a-fA-F:.]+\]|[A-Za-z0-9.-]+)(:\d{1,5})?$/;

/** `protocolo://host[:puerto]` del pedido, o null si el Host no es una dirección válida. */
export function origenDelPedido(req: Pick<Request, 'protocol' | 'host'>): string | null {
  const host = req.host;
  if (!host || !HOST_VALIDO.test(host)) return null;
  const protocolo = req.protocol === 'https' ? 'https' : 'http';
  return `${protocolo}://${host}`;
}
