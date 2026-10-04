// R9 a R13: reglas de las reservas. Funciones puras: reciben `ahora` como parámetro.
import type { EstadoReserva } from '../../../../contrato/tipos.js';
import {
  aIsoConZona,
  diaEnZona,
  instanteEnZona,
} from '../../../comun/fechas/fechas.js';

const HORA_EN_MS = 60 * 60_000;
export const HORAS_DE_PLAZO_PARA_CANCELAR = 4;

export function inicioDelTurno(fecha: string, inicio: string): Date {
  return instanteEnZona(fecha, inicio);
}

/** Los turnos duran una hora; el último termina a medianoche. */
export function finDelTurno(fecha: string, inicio: string): Date {
  return new Date(inicioDelTurno(fecha, inicio).getTime() + HORA_EN_MS);
}

/** R10: el inicio del turno menos cuatro horas. */
export function cancelableHasta(fecha: string, inicio: string): Date {
  return new Date(
    inicioDelTurno(fecha, inicio).getTime() -
      HORAS_DE_PLAZO_PARA_CANCELAR * HORA_EN_MS,
  );
}

/** D2: `VGY-<MMDD>-<HH>-<6 caracteres>`. La parte aleatoria la pone el servicio. */
export function codigoQrDe(
  fecha: string,
  inicio: string,
  aleatorio: string,
): string {
  return `VGY-${fecha.slice(5, 7)}${fecha.slice(8, 10)}-${inicio.slice(0, 2)}-${aleatorio}`;
}

/** R9: activa = `confirmada` cuyo turno no terminó. */
export function esActiva(
  reserva: { estado: EstadoReserva; fecha: string; inicio: string },
  ahora: Date,
): boolean {
  return (
    reserva.estado === 'confirmada' &&
    finDelTurno(reserva.fecha, reserva.inicio).getTime() > ahora.getTime()
  );
}

/**
 * R13: el turno no terminó si empieza después de una hora atrás. Devuelve ese corte
 * como día y hora de reloj argentino para filtrar en la base sin SQL de un solo motor:
 * próxima ⇔ (fecha, inicio) > (dia, hora). Los turnos arrancan en punto, así que
 * truncar los segundos no cambia el resultado.
 */
export function corteDeProximas(ahora: Date): { dia: string; hora: string } {
  const corte = new Date(ahora.getTime() - HORA_EN_MS);
  return { dia: diaEnZona(corte), hora: aIsoConZona(corte).slice(11, 16) };
}

export type DecisionCancelacion =
  | { accion: 'cancelar'; tardia: boolean }
  | { accion: 'sin-cambios' }
  | { error: 'CANCELACION_FUERA_DE_PLAZO' | 'RESERVA_NO_CANCELABLE' };

/**
 * R12. Una ya cancelada no cambia. Sólo se cancela una `confirmada`. El dueño, hasta
 * `cancelableHasta`; el personal, mientras el turno no haya empezado, y si ya pasó el
 * plazo cuenta como cancelación tardía del dueño (D3).
 */
export function decidirCancelacion(p: {
  estado: EstadoReserva;
  fecha: string;
  inicio: string;
  ahora: Date;
  esDueno: boolean;
  esPersonal: boolean;
}): DecisionCancelacion {
  if (p.estado === 'cancelada') return { accion: 'sin-cambios' };
  if (p.estado !== 'confirmada') return { error: 'RESERVA_NO_CANCELABLE' };
  const pasoElPlazo =
    p.ahora.getTime() > cancelableHasta(p.fecha, p.inicio).getTime();
  if (p.esPersonal) {
    if (p.ahora.getTime() >= inicioDelTurno(p.fecha, p.inicio).getTime())
      return { error: 'RESERVA_NO_CANCELABLE' };
    return { accion: 'cancelar', tardia: pasoElPlazo };
  }
  if (pasoElPlazo) return { error: 'CANCELACION_FUERA_DE_PLAZO' };
  return { accion: 'cancelar', tardia: false };
}
