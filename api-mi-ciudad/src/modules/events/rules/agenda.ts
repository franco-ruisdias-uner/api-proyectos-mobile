import { TZDate } from '@date-fns/tz';
import { ZONA } from '../../../common/dates/dates.js';

export type EstadoGuardado = 'programado' | 'suspendido' | 'cancelado';
export type EstadoEventoContrato = EstadoGuardado | 'finalizado';

const DIA_VALIDO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es un día real del calendario en formato `AAAA-MM-DD`? */
export function esDiaValido(dia: string): boolean {
  const partes = DIA_VALIDO.exec(dia);
  if (!partes) return false;
  const [, a, m, d] = partes.map(Number);
  // Los años de 1900 a 2999: más allá, ni `datetime` de MySQL ni los años de dos cifras andan bien.
  if (a < 1900 || a > 2999) return false;
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/** Instante de las 00:00 (Buenos Aires) de un día `AAAA-MM-DD`. */
export function comienzoDelDia(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(new TZDate(a, m - 1, d, 0, 0, 0, ZONA).getTime());
}

/** Instante de las 00:00 (Buenos Aires) del día siguiente: el fin, exclusivo, de un día. */
export function comienzoDelDiaSiguiente(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(new TZDate(a, m - 1, d + 1, 0, 0, 0, ZONA).getTime());
}

/** R8: sin `fin`, el evento cuenta hasta las 23:59 (:59) del día de su `inicio`, en Buenos Aires. */
export function finEfectivo(inicio: Date, fin: Date | null): Date {
  if (fin) return fin;
  const local = new TZDate(inicio.getTime(), ZONA);
  return new Date(
    new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 23, 59, 59, ZONA).getTime(),
  );
}

/** R9 (D3): un evento `programado` cuyo fin efectivo ya pasó sale como `finalizado`. */
export function estadoVisible(
  guardado: EstadoGuardado,
  finEfectivoDelEvento: Date,
  ahora: Date,
): EstadoEventoContrato {
  return guardado === 'programado' && finEfectivoDelEvento.getTime() < ahora.getTime()
    ? 'finalizado'
    : guardado;
}

/**
 * R8: ¿el intervalo del evento se superpone con el intervalo `[desde, hasta)`? Un evento que
 * termina justo a la medianoche no cuenta en el día siguiente.
 */
export function seSuperpone(inicio: Date, fin: Date, desde: Date, hasta: Date | null): boolean {
  const empiezaAntesDelFinal = hasta === null || inicio.getTime() < hasta.getTime();
  return empiezaAntesDelFinal && (inicio.getTime() >= desde.getTime() || fin.getTime() > desde.getTime());
}
