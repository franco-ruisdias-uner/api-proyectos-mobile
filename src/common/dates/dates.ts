import { TZDate } from '@date-fns/tz';

/** La zona de todo el proyecto. "Hoy", el día de la semana y la medianoche se calculan acá. */
export const ZONA = 'America/Argentina/Buenos_Aires';

const ISO_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;

/** Instante → "2026-11-14T21:00:00-03:00": offset de Buenos Aires y sin milisegundos. */
export function aIsoConZona(instante: Date): string {
  // TZDate.toISOString() devuelve "AAAA-MM-DDTHH:MM:SS.sss-03:00"; sacamos los milisegundos.
  return new TZDate(instante.getTime(), ZONA).toISOString().replace(/\.\d{3}(?=[+-])/, '');
}

/** Día "AAAA-MM-DD" en Buenos Aires para ese instante. */
export function hoyEnZona(instante: Date): string {
  const d = new TZDate(instante.getTime(), ZONA);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Día de la semana en Buenos Aires: 0 = domingo. */
export function diaDeSemanaEnZona(instante: Date): number {
  return new TZDate(instante.getTime(), ZONA).getDay();
}

/** Año y mes (1-12) en Buenos Aires. */
export function anioYMesEnZona(instante: Date): { anio: number; mes: number } {
  const d = new TZDate(instante.getTime(), ZONA);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

/**
 * Texto ISO 8601 con offset (o Z) → Date. Sin zona, mal formado o con una fecha que no
 * existe (30/02) devuelve null.
 */
export function parsearInstante(texto: string): Date | null {
  const m = ISO_CON_ZONA.exec(texto);
  if (!m) return null;
  const [, anio, mes, dia, hora, minuto, segundo] = m;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  // Date normaliza "2026-02-30" a marzo: lo detectamos comparando contra el texto en su offset.
  const offset = m[7] === 'Z' ? '+00:00' : m[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  const reconstruida = new TZDate(fecha.getTime(), offset);
  if (
    reconstruida.getFullYear() !== Number(anio) ||
    reconstruida.getMonth() + 1 !== Number(mes) ||
    reconstruida.getDate() !== Number(dia) ||
    reconstruida.getHours() !== Number(hora) ||
    reconstruida.getMinutes() !== Number(minuto) ||
    reconstruida.getSeconds() !== Number(segundo ?? 0)
  ) {
    return null;
  }
  return fecha;
}
