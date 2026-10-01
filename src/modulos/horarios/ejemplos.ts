import type { Feriado } from '../../../contrato/api.js';
import type { Horario } from '../../../contrato/tipos.js';

/** Ejemplos del PRD, para Swagger. */
export const HORARIO_DE_EJEMPLO: Horario = {
  id: 'hor-4410',
  lineaId: 'lin-05',
  paradaId: 'par-101',
  sentido: 'ida',
  tipoDeDia: 'habil',
  hora: '10:42',
};

export const FERIADO_DE_EJEMPLO: Feriado = {
  fecha: '2026-05-25',
  nombre: 'Día de la Revolución de Mayo',
};
