import type { Bloqueo } from '../../../contract/api.js';
import type { ReservaFija } from '../../../contract/types.js';
import type { BloqueoEntidad } from '../slots/block.entity.js';
import type { ReservaFijaEntidad } from '../slots/standing-booking.entity.js';

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
