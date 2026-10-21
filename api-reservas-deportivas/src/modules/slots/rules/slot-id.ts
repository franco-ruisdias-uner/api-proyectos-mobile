// Id de turno determinístico (ESPECIFICACION D1): tur-<espacioId>-<AAAAMMDD>-<HH>.
// El turno no se guarda: el servidor lo arma y lo desarma con estas dos funciones.
import { esDiaValido } from '../../../common/dates/dates.js';

const ID_TURNO = /^tur-(esp-[A-Za-z0-9_-]{1,36})-(\d{8})-(\d{2})$/;

export interface PartesDeTurno {
  espacioId: string;
  fecha: string;
  inicio: string;
}

export function idDeTurno(
  espacioId: string,
  fecha: string,
  inicio: string,
): string {
  return `tur-${espacioId}-${fecha.replaceAll('-', '')}-${inicio.slice(0, 2)}`;
}

/** Desarma un id de turno. Devuelve null si no tiene la forma o el turno no existe (08 a 23). */
export function leerIdDeTurno(id: string): PartesDeTurno | null {
  const m = ID_TURNO.exec(id);
  if (!m) return null;
  const [, espacioId, compacto, hh] = m;
  const fecha = `${compacto.slice(0, 4)}-${compacto.slice(4, 6)}-${compacto.slice(6)}`;
  const hora = Number(hh);
  if (!esDiaValido(fecha) || hora < 8 || hora > 23) return null;
  return { espacioId, fecha, inicio: `${hh}:00` };
}
