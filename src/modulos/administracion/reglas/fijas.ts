// R3 y R19: qué cubre una fija y cuándo dos se pisan.
import { diaDeSemana, esDiaValido } from '../../../comun/fechas/fechas.js';

export interface DatosDeFija {
  dia: number;
  inicio: string;
  fin: string;
  desde: string;
  hasta: string | null;
}

/** R3: día de la semana, vigencia y [inicio, fin). No mira `activa`: eso lo decide quien llama. */
export function fijaCubre(
  f: DatosDeFija,
  fecha: string,
  inicioDelTurno: string,
): boolean {
  return (
    diaDeSemana(fecha) === f.dia &&
    f.desde <= fecha &&
    (f.hasta === null || fecha <= f.hasta) &&
    inicioDelTurno >= f.inicio &&
    inicioDelTurno < f.fin
  );
}

/** R19: `desde` y `hasta` son días reales y `desde ≤ hasta`. */
export function validarFechasDeFija(
  desde: string,
  hasta: string | null,
): string | null {
  if (!esDiaValido(desde))
    return 'La fecha de inicio tiene que ser un día con la forma AAAA-MM-DD.';
  if (hasta !== null && !esDiaValido(hasta))
    return 'La fecha de fin tiene que ser un día con la forma AAAA-MM-DD.';
  if (hasta !== null && desde > hasta)
    return 'La fecha de inicio tiene que ser anterior o igual a la de fin.';
  return null;
}

/** R19: mismo día de la semana, horas que se pisan y vigencias que se tocan. */
export function fijasSeSuperponen(a: DatosDeFija, b: DatosDeFija): boolean {
  if (a.dia !== b.dia) return false;
  if (!(a.inicio < b.fin && b.inicio < a.fin)) return false;
  const aTerminaAntes = a.hasta !== null && a.hasta < b.desde;
  const bTerminaAntes = b.hasta !== null && b.hasta < a.desde;
  return !aTerminaAntes && !bTerminaAntes;
}
