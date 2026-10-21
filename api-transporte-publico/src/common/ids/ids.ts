import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id nuevo generado por el servidor: prefijo + 12 caracteres [a-z0-9] (AGENTS §4.3). */
export function nuevoId(prefijo: string): string {
  let sufijo = '';
  for (let i = 0; i < 12; i++) sufijo += ALFABETO[randomInt(ALFABETO.length)];
  return `${prefijo}-${sufijo}`;
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Id con el prefijo correcto: sirve para los de las semillas ("lin-05") y los generados. */
export function esIdDe(prefijo: string, valor: string): boolean {
  return new RegExp(`^${escapar(prefijo)}-[A-Za-z0-9_-]{1,36}$`).test(valor);
}

/** Id generado por el teléfono para la cola offline (AGENTS §10.5). */
export function esIdDeCliente(prefijo: string, valor: string): boolean {
  return new RegExp(`^${escapar(prefijo)}-[A-Za-z0-9_-]{3,36}$`).test(valor);
}
