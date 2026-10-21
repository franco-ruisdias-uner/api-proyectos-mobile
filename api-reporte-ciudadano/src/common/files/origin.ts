// Origen de las URLs de archivos (AGENTS §8): URL_PUBLICA si está; si no, el protocolo y el
// Host del pedido (la dirección que usó el teléfono). Se guarda por pedido con
// AsyncLocalStorage para que los mapeadores no tengan que recibir el request.
import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { PREFIJO_RUTA } from './keys.js';

const origenDelPedido = new AsyncLocalStorage<string>();

@Injectable()
export class MiddlewareOrigen implements NestMiddleware {
  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    // Con CONFIAR_PROXY, Express ya lee X-Forwarded-Proto y X-Forwarded-Host (trust proxy).
    const origen =
      this.entorno.URL_PUBLICA ??
      `${req.protocol}://${req.host ?? 'localhost'}`;
    origenDelPedido.run(origen, next);
  }
}

/** Corre `fn` con un origen fijo (semillas, scripts). */
export const conOrigen = <T>(origen: string, fn: () => T): T =>
  origenDelPedido.run(origen, fn);

/** URL absoluta de una clave, con el origen del pedido en curso. */
export function urlDeArchivo(clave: string): string {
  const origen = origenDelPedido.getStore() ?? 'http://localhost:3000';
  return `${origen}${PREFIJO_RUTA}${clave}`;
}

/** Ídem, pero null se queda null (campos opcionales como audioUrl). */
export const urlDeArchivoONulo = (clave: string | null): string | null =>
  clave === null ? null : urlDeArchivo(clave);
