import type { TipoDeDia } from '../../../../contrato/tipos.js';

/**
 * R6: el tipo de día de una fecha "AAAA-MM-DD", en orden de prioridad:
 * feriado > domingo > sábado > hábil. Es aritmética de calendario sobre el texto: no depende
 * de la zona de la máquina.
 */
export function tipoDeDia(dia: string, feriados: ReadonlySet<string>): TipoDeDia {
  if (feriados.has(dia)) return 'feriado';
  const diaDeLaSemana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  if (diaDeLaSemana === 0) return 'domingo';
  if (diaDeLaSemana === 6) return 'sabado';
  return 'habil';
}
