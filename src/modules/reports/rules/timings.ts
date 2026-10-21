const MINUTO = 60_000;

/** R14: cuánto tiempo se muestra un reporte de demora (D6). */
export const MINUTOS_DE_VIGENCIA = 90;
/** R13: separación mínima entre dos reportes de una persona sobre la misma línea y parada (D7). */
export const MINUTOS_ENTRE_REPORTES = 15;
/** AGENTS §10.5: tolerancia por relojes de teléfono desfasados. */
export const MINUTOS_DE_TOLERANCIA = 5;

/** Desde cuándo un reporte es reciente. */
export function limiteDeRecientes(ahora: Date): Date {
  return new Date(ahora.getTime() - MINUTOS_DE_VIGENCIA * MINUTO);
}

/** R14: `fechaHora` dentro de los últimos 90 minutos (el límite entra). */
export function esReciente(fechaHora: Date, ahora: Date): boolean {
  return fechaHora.getTime() >= limiteDeRecientes(ahora).getTime();
}

/** R13: dos reportes a menos de 15 minutos uno del otro (en cualquier sentido) chocan. */
export function chocaConOtroReporte(nueva: Date, existente: Date): boolean {
  return Math.abs(nueva.getTime() - existente.getTime()) < MINUTOS_ENTRE_REPORTES * MINUTO;
}

/** R12: la fecha del hecho no puede ser posterior a ahora (más la tolerancia). */
export function esFechaFutura(fechaHora: Date, ahora: Date): boolean {
  return fechaHora.getTime() > ahora.getTime() + MINUTOS_DE_TOLERANCIA * MINUTO;
}
