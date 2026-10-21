import { TZDate } from '@date-fns/tz';
import { format, isValid, parseISO } from 'date-fns';

/** Zona de todos los cálculos de "hoy", día de la semana y medianoche. */
export const ZONA = 'America/Argentina/Buenos_Aires';

/** Instante → "2026-11-14T21:00:00-03:00" (sin milisegundos, con offset de la zona). */
export function aIsoConZona(instante: Date): string {
  return format(new TZDate(instante.getTime(), ZONA), "yyyy-MM-dd'T'HH:mm:ssxxx");
}

/** Instante → "AAAA-MM-DD" del día en la zona. */
export function diaLocal(instante: Date): string {
  return format(new TZDate(instante.getTime(), ZONA), 'yyyy-MM-dd');
}

/** Instante → día de la semana en la zona (0 = domingo). */
export function diaDeLaSemana(instante: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return new TZDate(instante.getTime(), ZONA).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

const INSTANTE_CON_ZONA =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** ¿Es un instante ISO 8601 válido con offset o Z? */
export function esInstanteConZona(texto: string): boolean {
  return leerInstante(texto) !== null;
}

/** Lee un instante ISO con offset o Z; `null` si no es válido. */
export function leerInstante(texto: string): Date | null {
  const partes = INSTANTE_CON_ZONA.exec(texto);
  if (!partes) return null;
  const [, anio, mes, dia] = partes;
  // Rechaza fechas imposibles (30 de febrero) que Date corregiría solo.
  const calendario = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
  if (
    calendario.getUTCFullYear() !== Number(anio) ||
    calendario.getUTCMonth() !== Number(mes) - 1 ||
    calendario.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  const instante = parseISO(texto);
  return isValid(instante) ? instante : null;
}
