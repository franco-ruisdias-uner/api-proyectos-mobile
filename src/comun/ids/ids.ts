import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Id nuevo con el prefijo del PRD: `nuevoId('usr')` → "usr-k3j9x0m2a7qz". */
export function nuevoId(prefijo: string): string {
  return `${prefijo}-${aleatorio(12)}`;
}

/** Texto aleatorio [a-z0-9] de `largo` caracteres. */
export function aleatorio(largo: number, alfabeto = ALFABETO): string {
  let texto = '';
  for (let i = 0; i < largo; i++) texto += alfabeto[randomInt(alfabeto.length)];
  return texto;
}

/** Id con el prefijo esperado, como los que genera el servidor o el teléfono (AGENTS §10.5). */
export function esIdValido(id: string, prefijo: string): boolean {
  return new RegExp(`^${prefijo}-[A-Za-z0-9_-]{3,36}$`).test(id);
}
