import { AsyncLocalStorage } from 'node:async_hooks';

interface ContextoDePedido {
  /** "http://192.168.0.10:3000": el origen por el que llegó el teléfono. */
  origen: string;
}

const almacen = new AsyncLocalStorage<ContextoDePedido>();

/** Corre `siguiente` con el origen del pedido guardado (AGENTS §8). */
export function conContexto(contexto: ContextoDePedido, siguiente: () => void): void {
  almacen.run(contexto, siguiente);
}

/** Origen del pedido en curso; fuera de un pedido (semillas, scripts), el de respaldo. */
export function origenActual(respaldo = 'http://localhost:3000'): string {
  return almacen.getStore()?.origen ?? respaldo;
}
