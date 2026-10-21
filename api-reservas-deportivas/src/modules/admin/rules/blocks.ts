// R4 y R18: qué cubre un bloqueo y qué turnos ya no se pueden cancelar por él.
import { instanteEnZona } from '../../../common/dates/dates.js';

const HORA_EN_MS = 60 * 60_000;

/** Un bloqueo sin horas cubre el día entero; con horas, los turnos dentro de [inicio, fin). */
export function bloqueoCubre(
  b: { inicio: string | null; fin: string | null },
  inicioDelTurno: string,
): boolean {
  if (b.inicio === null || b.fin === null) return true;
  return inicioDelTurno >= b.inicio && inicioDelTurno < b.fin;
}

/** ¿Ya terminó ese turno (que dura una hora)? Esos no se cancelan ni se avisan. */
export function turnoTerminado(
  fecha: string,
  inicio: string,
  ahora: Date,
): boolean {
  return (
    instanteEnZona(fecha, inicio).getTime() + HORA_EN_MS <= ahora.getTime()
  );
}
