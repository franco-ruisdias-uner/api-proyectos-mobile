// Identificadores con prefijo (AGENTS §4.3): "usr-" + 12 caracteres [a-z0-9].
import { randomInt } from 'node:crypto';

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Texto aleatorio de `largo` caracteres del alfabeto indicado. */
export function textoAleatorio(largo: number, alfabeto = ALFABETO): string {
  let salida = '';
  for (let i = 0; i < largo; i++)
    salida += alfabeto[randomInt(alfabeto.length)];
  return salida;
}

export function nuevoId(prefijo: string): string {
  return `${prefijo}-${textoAleatorio(12)}`;
}

/** ¿Tiene el prefijo pedido y una forma razonable? (los de semilla son cortos: "esp-02"). */
export function esIdDe(prefijo: string, valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    new RegExp(`^${prefijo}-[A-Za-z0-9_-]{1,36}$`).test(valor)
  );
}
