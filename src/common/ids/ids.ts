import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Genera un id nuevo: `<prefijo>-` + 12 caracteres [a-z0-9]. */
export function nuevoId(prefijo: string): string {
  let cola = '';
  for (let i = 0; i < 12; i++) cola += ALFABETO[randomInt(ALFABETO.length)];
  return `${prefijo}-${cola}`;
}

/** ¿El id tiene el prefijo pedido y un cuerpo razonable? (validación antes de ir a la base) */
export function esIdConPrefijo(id: string, prefijo: string): boolean {
  return new RegExp(`^${prefijo}-[A-Za-z0-9_-]{1,36}$`).test(id);
}

/** Id generado por el teléfono para la cola offline (AGENTS §10.5). */
export function esIdDeCliente(id: string, prefijo: string): boolean {
  return new RegExp(`^${prefijo}-[A-Za-z0-9_-]{3,36}$`).test(id);
}
