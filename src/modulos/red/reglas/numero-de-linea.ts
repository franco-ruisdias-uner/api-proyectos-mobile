/** El número de la línea como entero ("8A" → 8); sin dígitos al principio, va al final. */
export function ordenDeNumero(numero: string): number {
  const digitos = /^\d+/.exec(numero.trim());
  return digitos ? Number(digitos[0]) : Number.MAX_SAFE_INTEGER;
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
