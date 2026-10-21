/** Cabe en una columna `int` de los cuatro motores (AGENTS §5.3). */
export const ORDEN_SIN_NUMERO = 2147483647;

/** El número de la línea como entero ("8A" → 8); sin dígitos al principio, va al final. */
export function ordenDeNumero(numero: string): number {
  const digitos = /^\d+/.exec(numero.trim());
  return digitos ? Math.min(Number(digitos[0]), ORDEN_SIN_NUMERO) : ORDEN_SIN_NUMERO;
}

interface ConNumero {
  id: string;
  numero: string;
  numeroOrden: number;
}

/** Orden determinístico: número, después el texto del número y al final el id (AGENTS §4.2). */
export function compararLineas(a: ConNumero, b: ConNumero): number {
  return (
    a.numeroOrden - b.numeroOrden ||
    (a.numero < b.numero ? -1 : a.numero > b.numero ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
