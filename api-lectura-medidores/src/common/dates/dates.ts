import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const ZONA = 'America/Argentina/Buenos_Aires';

/** Instante → "2026-11-14T21:00:00-03:00" (hora argentina, sin milisegundos). */
export function aIsoConZona(instante: Date): string {
  return format(
    new TZDate(instante.getTime(), ZONA),
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
}

/** Instante → "AAAA-MM-DD" del día en Argentina. */
export function diaEnArgentina(instante: Date): string {
  return format(new TZDate(instante.getTime(), ZONA), 'yyyy-MM-dd');
}

/** Instante → "DD/MM" en Argentina (para mensajes). */
export function diaYMesEnArgentina(instante: Date): string {
  return format(new TZDate(instante.getTime(), ZONA), 'dd/MM');
}

const ISO_CON_ZONA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Lee un instante ISO 8601 que trae zona (offset o Z). Devuelve null si no es válido
 * o si no dice la zona: sin zona no se sabe qué hora es.
 */
export function leerInstante(texto: string): Date | null {
  if (!ISO_CON_ZONA.test(texto)) return null;
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return null;
  // Rechaza fechas imposibles que Date "corrige" (31 de febrero).
  const [anio, mes, dia] = texto.slice(0, 10).split('-').map(Number);
  const control = new Date(Date.UTC(anio, mes - 1, dia));
  if (control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) {
    return null;
  }
  return fecha;
}
