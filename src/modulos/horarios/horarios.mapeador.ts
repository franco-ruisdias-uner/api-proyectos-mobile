import type { Feriado } from '../../../contrato/api.js';
import type { Horario } from '../../../contrato/tipos.js';
import type { FeriadoEntidad } from './feriado.entidad.js';
import type { HorarioEntidad } from './horario.entidad.js';

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
