// R1 a R5: el cruce de reservas, fijas y bloqueos que arma la grilla de un día.
// Función pura: no sabe de "ahora" (los turnos pasados se muestran con su estado, R6).
import type { EstadoReserva, Turno } from '../../../../contrato/tipos.js';
import { diaDeSemana } from '../../../comun/fechas/fechas.js';
import { idDeTurno } from './id-turno.js';

export const PRIMERA_HORA = 8;
export const ULTIMA_HORA = 24;

export interface ReservaDeGrilla {
  id: string;
  inicio: string;
  estado: EstadoReserva;
}

export interface FijaDeGrilla {
  titular: string;
  dia: number;
  inicio: string;
  fin: string;
  desde: string;
  hasta: string | null;
  activa: boolean;
}

export interface BloqueoDeGrilla {
  inicio: string | null;
  fin: string | null;
  motivo: string;
}

const hora = (h: number): string => `${String(h).padStart(2, '0')}:00`;

/** Un turno entra en [inicio, fin) si empieza ahí (las horas son en punto). */
const dentro = (turnoInicio: string, inicio: string, fin: string): boolean =>
  turnoInicio >= inicio && turnoInicio < fin;

/**
 * Los 16 turnos de `fecha` para un espacio. Recibe las reservas, fijas y bloqueos
 * del espacio (las de otros días se descartan acá). Prioridad (R2):
 * mantenimiento > fijo > reservado > libre.
 */
export function armarGrilla(
  espacio: { id: string; precioPorHora: number },
  fecha: string,
  reservas: ReservaDeGrilla[],
  fijas: FijaDeGrilla[],
  bloqueos: BloqueoDeGrilla[],
): Turno[] {
  const dia = diaDeSemana(fecha);
  const fijasDelDia = fijas.filter(
    (f) =>
      f.activa &&
      f.dia === dia &&
      f.desde <= fecha &&
      (f.hasta === null || fecha <= f.hasta),
  );
  const ocupan = reservas.filter((r) => r.estado !== 'cancelada');

  const turnos: Turno[] = [];
  for (let h = PRIMERA_HORA; h < ULTIMA_HORA; h++) {
    const inicio = hora(h);
    const bloqueo = bloqueos.find((b) =>
      b.inicio === null || b.fin === null
        ? true
        : dentro(inicio, b.inicio, b.fin),
    );
    const cubreFija = fijasDelDia.some((f) => dentro(inicio, f.inicio, f.fin));
    const reserva = ocupan.find((r) => r.inicio === inicio);

    let estado: Turno['estado'] = 'libre';
    if (bloqueo) estado = 'mantenimiento';
    else if (cubreFija) estado = 'fijo';
    else if (reserva) estado = 'reservado';

    turnos.push({
      id: idDeTurno(espacio.id, fecha, inicio),
      espacioId: espacio.id,
      fecha,
      inicio,
      fin: hora(h + 1),
      estado,
      reservaId: estado === 'reservado' && reserva ? reserva.id : null,
      motivoBloqueo:
        estado === 'mantenimiento' && bloqueo ? bloqueo.motivo : null,
      precio: espacio.precioPorHora,
    });
  }
  return turnos;
}
