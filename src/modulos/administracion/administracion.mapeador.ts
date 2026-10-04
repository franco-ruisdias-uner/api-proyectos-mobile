import type { Bloqueo } from '../../../contrato/api.js';
import type { ReservaFija } from '../../../contrato/tipos.js';
import type { BloqueoEntidad } from '../turnos/bloqueo.entidad.js';
import type { ReservaFijaEntidad } from '../turnos/reserva-fija.entidad.js';

export function bloqueoAContrato(b: BloqueoEntidad): Bloqueo {
  return {
    id: b.id,
    espacioId: b.espacioId,
    fecha: b.fecha,
    inicio: b.inicio,
    fin: b.fin,
    motivo: b.motivo,
  };
}

export function fijaAContrato(f: ReservaFijaEntidad): ReservaFija {
  return {
    id: f.id,
    espacioId: f.espacioId,
    titular: f.titular,
    dia: f.dia as ReservaFija['dia'],
    inicio: f.inicio,
    fin: f.fin,
    desde: f.desde,
    hasta: f.hasta,
    activa: f.activa,
  };
}
