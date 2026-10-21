import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `nuevoId('usr')` → "usr-" + 12 caracteres [a-z0-9]. */
export function nuevoId(prefijo: string): string {
  let sufijo = '';
  for (let i = 0; i < 12; i++) sufijo += ALFABETO[randomInt(ALFABETO.length)];
  return `${prefijo}-${sufijo}`;
}

/** ¿Tiene forma de id con ese prefijo? (los de la semilla, los del servidor y los del teléfono). */
export function esIdDe(prefijo: string, valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    new RegExp(`^${prefijo}-[A-Za-z0-9_-]{1,36}$`).test(valor)
  );
}
