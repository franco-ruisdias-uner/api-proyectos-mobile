// Ids de texto con prefijo (AGENTS §4.3 y §10.5).
import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function textoAleatorio(largo: number): string {
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO[randomInt(ALFABETO.length)];
  return s;
}

/** Id nuevo generado por el servidor: `usr-` + 12 caracteres [a-z0-9]. */
export function nuevoId(prefijo: string): string {
  return `${prefijo}-${textoAleatorio(12)}`;
}

/** Forma admitida para un id (del servidor, de las semillas o generado por el teléfono). */
export const patronId = (prefijo: string): RegExp =>
  new RegExp(`^${prefijo}-[A-Za-z0-9_-]{3,36}$`);

/** ¿Tiene la forma de un id de esa entidad? Se chequea antes de ir a la base. */
export function esIdDe(prefijo: string, valor: unknown): valor is string {
  return typeof valor === 'string' && patronId(prefijo).test(valor);
}

/** Id generado por el cliente para la cola offline: /^<prefijo>-[A-Za-z0-9_-]{3,36}$/. */
export const esIdDeCliente = esIdDe;
