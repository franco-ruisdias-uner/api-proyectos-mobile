// Fechas del contrato (AGENTS §4.3 y §6). Toda salida pasa por aIsoConZona().
import { format } from 'date-fns';
import { tz } from '@date-fns/tz';

export const ZONA = 'America/Argentina/Buenos_Aires';
const enZona = tz(ZONA);

/** "2026-11-14T21:00:00-03:00": ISO 8601 con el offset de Buenos Aires y sin milisegundos. */
export function aIsoConZona(instante: Date): string {
  return format(instante, "yyyy-MM-dd'T'HH:mm:ssXXX", { in: enZona });
}

/** "AAAA-MM-DD" del día en Buenos Aires. */
export function diaEnZona(instante: Date): string {
  return format(instante, 'yyyy-MM-dd', { in: enZona });
}

/** Año y mes ("2026", "09") en Buenos Aires. */
export function anioMesEnZona(instante: Date): { anio: string; mes: string } {
  return {
    anio: format(instante, 'yyyy', { in: enZona }),
    mes: format(instante, 'MM', { in: enZona }),
  };
}

const ISO_CON_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|([+-])(\d{2}):?(\d{2}))$/;

/**
 * Lee un instante ISO 8601 con offset (o Z). Sin offset, o con una fecha que no existe,
 * devuelve null. Descarta los milisegundos.
 */
export function parsearInstante(texto: unknown): Date | null {
  if (typeof texto !== 'string') return null;
  const m = ISO_CON_OFFSET.exec(texto.trim());
  if (!m) return null;
  const [, a, me, d, h, mi, s = '00', z, signo, oh, om] = m;
  const [anio, mes, dia, hora, minuto, segundo] = [a, me, d, h, mi, s].map(
    Number,
  );
  if (mes < 1 || mes > 12 || hora > 23 || minuto > 59 || segundo > 59)
    return null;
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  if (dia < 1 || dia > diasDelMes) return null;

  let offsetMinutos = 0;
  if (z !== 'Z') {
    const [hOff, mOff] = [Number(oh), Number(om)];
    if (hOff > 14 || mOff > 59) return null;
    offsetMinutos = (signo === '-' ? -1 : 1) * (hOff * 60 + mOff);
  }
  const utc =
    Date.UTC(anio, mes - 1, dia, hora, minuto, segundo) -
    offsetMinutos * 60_000;
  return new Date(utc);
}

/** Saca los milisegundos: los cuatro motores guardan lo mismo y la salida no los lleva. */
export function sinMilisegundos(instante: Date): Date {
  return new Date(Math.floor(instante.getTime() / 1000) * 1000);
}
