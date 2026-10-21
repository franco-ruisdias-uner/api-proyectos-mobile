/** Tolerancia por relojes desfasados entre el teléfono y el servidor (AGENTS §10.5). */
export const TOLERANCIA_FUTURO_MS = 5 * 60_000;
export const LARGO_MAXIMO_NOTA = 280;

/** R14: la fecha de la visita no puede ser posterior a "ahora" más 5 minutos. */
export function estaEnElFuturo(fechaHora: Date, ahora: Date): boolean {
  return fechaHora.getTime() > ahora.getTime() + TOLERANCIA_FUTURO_MS;
}

/** R15: sin espacios de los costados; vacía → `null`; `undefined` (no vino) queda igual. */
export function normalizarNota(nota: string | null | undefined): string | null | undefined {
  if (nota === undefined || nota === null) return nota;
  const recortada = nota.trim();
  return recortada === '' ? null : recortada;
}
