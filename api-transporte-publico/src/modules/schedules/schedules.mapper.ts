import type { Feriado } from '../../../contract/api.js';
import type { Horario } from '../../../contract/types.js';
import type { FeriadoEntidad } from './holiday.entity.js';
import type { HorarioEntidad } from './schedule.entity.js';

export function horarioAContrato(h: HorarioEntidad): Horario {
  return {
    id: h.id,
    lineaId: h.lineaId,
    paradaId: h.paradaId,
    sentido: h.sentido,
    tipoDeDia: h.tipoDeDia,
    hora: h.hora,
  };
}

export function feriadoAContrato(f: FeriadoEntidad): Feriado {
  return { fecha: f.fecha, nombre: f.nombre };
}
