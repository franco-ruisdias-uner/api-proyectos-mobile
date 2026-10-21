// R14 y R15: ingreso con QR y ausentes. Funciones puras: reciben `ahora` como parámetro.
import type { EstadoReserva } from '../../../../contract/types.js';
import { diaEnZona } from '../../../common/dates/dates.js';
import type { CodigoError } from '../../../common/errors/catalog.js';
import { finDelTurno, inicioDelTurno } from '../../bookings/rules/bookings.js';

const MINUTO_EN_MS = 60_000;
/** D10: se puede entrar desde media hora antes del inicio. */
export const MINUTOS_ANTES_PARA_INGRESAR = 30;
/** D10: se puede marcar ausente desde 15 minutos después del inicio. */
export const MINUTOS_DESPUES_PARA_AUSENTE = 15;

interface ReservaParaIngreso {
  estado: EstadoReserva;
  espacioId: string;
  fecha: string;
  inicio: string;
}

/**
 * R14, en este orden: cancelada, de otro día, de otro espacio, ya registrada y fuera de
 * horario. Devuelve el código del primer problema, o null si puede entrar. El horario es
 * de `inicio − 30 min` (inclusive) hasta el fin del turno (exclusive).
 */
export function decidirIngreso(
  p: ReservaParaIngreso & {
    espacioPedido: string;
    ingresoEn: Date | null;
    ahora: Date;
  },
): CodigoError | null {
  if (p.estado === 'cancelada') return 'RESERVA_CANCELADA';
  if (p.fecha !== diaEnZona(p.ahora)) return 'CODIGO_DE_OTRO_DIA';
  if (p.espacioId !== p.espacioPedido) return 'CODIGO_DE_OTRO_ESPACIO';
  if (p.estado === 'cumplida' || p.ingresoEn) return 'INGRESO_YA_REGISTRADO';
  if (p.estado === 'ausente') return 'RESERVA_AUSENTE';
  const desde =
    inicioDelTurno(p.fecha, p.inicio).getTime() -
    MINUTOS_ANTES_PARA_INGRESAR * MINUTO_EN_MS;
  const hasta = finDelTurno(p.fecha, p.inicio).getTime();
  const t = p.ahora.getTime();
  if (t < desde || t >= hasta) return 'FUERA_DE_HORARIO';
  return null;
}

export type DecisionAusente =
  | { accion: 'marcar' }
  | { accion: 'sin-cambios' }
  | {
      error: 'RESERVA_CANCELADA' | 'INGRESO_YA_REGISTRADO' | 'ANTES_DE_TIEMPO';
    };

/**
 * R15: sólo una `confirmada`, desde 15 minutos después del inicio. Una ya `ausente` no
 * cambia (reintento); una cancelada o ya ingresada no se puede marcar.
 */
export function decidirAusente(
  p: ReservaParaIngreso & { ahora: Date },
): DecisionAusente {
  if (p.estado === 'ausente') return { accion: 'sin-cambios' };
  if (p.estado === 'cancelada') return { error: 'RESERVA_CANCELADA' };
  if (p.estado === 'cumplida') return { error: 'INGRESO_YA_REGISTRADO' };
  const desde =
    inicioDelTurno(p.fecha, p.inicio).getTime() +
    MINUTOS_DESPUES_PARA_AUSENTE * MINUTO_EN_MS;
  if (p.ahora.getTime() < desde) return { error: 'ANTES_DE_TIEMPO' };
  return { accion: 'marcar' };
}
