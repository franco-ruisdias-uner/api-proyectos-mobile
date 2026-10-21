import { tz } from '@date-fns/tz';
import { addDays, format, parseISO } from 'date-fns';

/** La zona de la aplicación: "hoy" y los cortes de medianoche se calculan acá. */
export const ZONA = 'America/Argentina/Buenos_Aires';

const enZona = { in: tz(ZONA) };

/** "2026-11-14T21:00:00-03:00": instante en la zona de Buenos Aires, sin milisegundos. */
export function aIsoConZona(instante: Date): string {
  return format(instante, "yyyy-MM-dd'T'HH:mm:ssXXX", enZona);
}

/** "AAAA-MM-DD" del instante, en Buenos Aires. */
export function diaEnZona(instante: Date): string {
  return format(instante, 'yyyy-MM-dd', enZona);
}

/** "HH:MM" del instante, en Buenos Aires. */
export function horaEnZona(instante: Date): string {
  return format(instante, 'HH:mm', enZona);
}

/** Día de la semana en Buenos Aires: 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(instante: Date): number {
  return Number(format(instante, 'i', enZona)) % 7;
}

/** Suma días a un día "AAAA-MM-DD" (sin zonas: es aritmética de calendario). */
export function sumarDias(dia: string, dias: number): string {
  return format(addDays(parseISO(dia), dias), 'yyyy-MM-dd');
}

const ISO_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Interpreta un instante ISO 8601 que trae offset o Z. Sin zona, o con una fecha que no
 * existe (30 de febrero), devuelve null.
 */
export function interpretarInstante(texto: string): Date | null {
  const partes = ISO_CON_ZONA.exec(texto);
  if (!partes) return null;
  const [, anio, mes, dia, hora, minuto, segundo] = partes;
  const instante = new Date(texto);
  if (Number.isNaN(instante.getTime())) return null;
  // Date acepta "2026-02-30" y lo corre al 2/3: se controla que la fecha escrita exista.
  const escrita = new Date(Date.UTC(+anio, +mes - 1, +dia, +hora, +minuto, +(segundo ?? 0)));
  if (
    escrita.getUTCFullYear() !== +anio ||
    escrita.getUTCMonth() !== +mes - 1 ||
    escrita.getUTCDate() !== +dia ||
    +hora > 23 ||
    +minuto > 59 ||
    +(segundo ?? 0) > 59
  ) {
    return null;
  }
  return instante;
}

/** El mismo instante sin milisegundos: así se guarda igual en los cuatro motores. */
export function sinMilisegundos(instante: Date): Date {
  return new Date(Math.floor(instante.getTime() / 1000) * 1000);
}
