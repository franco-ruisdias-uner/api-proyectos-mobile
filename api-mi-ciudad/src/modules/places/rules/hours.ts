import { TZDate } from '@date-fns/tz';
import type { Horario } from '../../../../contract/types.js';
import { ZONA } from '../../../common/dates/dates.js';
import type { HorarioConTemporada } from '../place-to-load.js';

/** D1: verano del 1/12 al 31/3; invierno el resto del año. Siempre en hora de Buenos Aires. */
export function temporadaEn(ahora: Date): 'verano' | 'invierno' {
  const mes = new TZDate(ahora.getTime(), ZONA).getMonth() + 1;
  return mes === 12 || mes <= 3 ? 'verano' : 'invierno';
}

/** Instante en que empezó la temporada vigente: 1/12 o 1/4 a las 00:00 de Buenos Aires. */
export function inicioDeTemporada(ahora: Date): Date {
  const local = new TZDate(ahora.getTime(), ZONA);
  const anio = local.getFullYear();
  const mes = local.getMonth() + 1;
  if (mes === 12) return new TZDate(anio, 11, 1, ZONA);
  if (mes <= 3) return new TZDate(anio - 1, 11, 1, ZONA);
  return new TZDate(anio, 3, 1, ZONA);
}

/**
 * R2 y R3: un elemento por tramo, sólo los de todo el año y los de la temporada de hoy,
 * ordenados por día y hora. La temporada no sale: el tipo `Horario` del PRD no la tiene.
 */
export function horariosVigentes(horarios: HorarioConTemporada[], ahora: Date): Horario[] {
  const temporada = temporadaEn(ahora);
  return horarios
    .filter((h) => h.temporada === 'todo-el-anio' || h.temporada === temporada)
    .map(({ dia, abre, cierra }) => ({ dia, abre, cierra }))
    .sort((a, b) => a.dia - b.dia || comparar(a.abre, b.abre) || comparar(a.cierra, b.cierra));
}

/**
 * D1: si los horarios dependen de la temporada, al empezar una temporada nueva el lugar
 * "cambió" (sus horarios vigentes son otros). Así `actualizadoDesde` se lo vuelve a mandar al
 * teléfono, que si no se quedaría con los horarios de la temporada anterior.
 */
export function actualizadoEnVigente(actualizadoEn: Date, tieneTemporadas: boolean, ahora: Date): Date {
  if (!tieneTemporadas) return actualizadoEn;
  const inicio = inicioDeTemporada(ahora);
  return inicio.getTime() > actualizadoEn.getTime() ? inicio : actualizadoEn;
}

const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
