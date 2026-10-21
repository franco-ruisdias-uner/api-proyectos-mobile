// La fecha del hecho la manda el teléfono (AGENTS §10.5): se acepta si no está en el futuro.

/** Tolerancia por relojes desfasados. */
export const TOLERANCIA_RELOJ_MS = 5 * 60 * 1000;

export const esFechaFutura = (fecha: Date, ahora: Date): boolean =>
  fecha.getTime() > ahora.getTime() + TOLERANCIA_RELOJ_MS;
