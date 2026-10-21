const ID_DE_RESENA = /^res-[A-Za-z0-9_-]{3,36}$/;

/** Id con la forma que genera el servidor o el teléfono (AGENTS §10.5). */
export const esIdDeResena = (id: string): boolean => ID_DE_RESENA.test(id);

/** R8/D7: promedio con un decimal; `0` si no hay reseñas. */
export function promedioDeEstrellas(estrellas: number[]): number {
  if (estrellas.length === 0) return 0;
  const suma = estrellas.reduce((a, e) => a + e, 0);
  return Math.round((suma / estrellas.length) * 10) / 10;
}

const TOLERANCIA_MS = 5 * 60 * 1000;

/** R15: no puede ser posterior a `ahora` (con 5 minutos de tolerancia por relojes desfasados). */
export const fechaEnElFuturo = (fecha: Date, ahora: Date): boolean =>
  fecha.getTime() > ahora.getTime() + TOLERANCIA_MS;

/**
 * Para las semillas: `cantidad` estrellas (de 1 a 5) cuyo promedio redondeado es `objetivo`
 * (o la entera más cercana si hay una sola). Reparte las estrellas lo más parejo posible.
 */
export function estrellasParaPromedio(cantidad: number, objetivo: number): number[] {
  if (cantidad === 0) return [];
  const suma = Math.round(objetivo * cantidad);
  const base = Math.floor(suma / cantidad);
  const extras = suma - base * cantidad;
  const estrellas = Array.from({ length: cantidad }, (_, i) => (i < extras ? base + 1 : base));
  return estrellas.map((e) => Math.min(5, Math.max(1, e)));
}
