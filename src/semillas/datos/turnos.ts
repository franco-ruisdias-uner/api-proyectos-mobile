// Reservas, fijas y bloqueos de demo (ESPECIFICACION §8), con fechas relativas a "hoy"
// para que la grilla siempre tenga algo para ver en los próximos siete días.
import type { EstadoReserva } from '../../../contrato/tipos.js';
import {
  diaDeSemana,
  instanteEnZona,
  sumarDias,
} from '../../comun/fechas/fechas.js';
import { textoAleatorio } from '../../comun/ids/ids.js';
import { idDeTurno } from '../../modulos/turnos/reglas/id-turno.js';

export interface FijaSemilla {
  id: string;
  espacioId: string;
  titular: string;
  dia: number;
  inicio: string;
  fin: string;
  desde: string;
  hasta: string | null;
  activa: boolean;
}

export interface BloqueoSemilla {
  id: string;
  espacioId: string;
  fecha: string;
  inicio: string | null;
  fin: string | null;
  motivo: string;
}

export interface ReservaSemilla {
  id: string;
  turnoId: string;
  espacioId: string;
  usuarioId: string;
  fecha: string;
  inicio: string;
  cantidadPersonas: number;
  codigoQr: string;
  estado: EstadoReserva;
  ingresoEn: Date | null;
  creadaEn: Date;
  ocupacion: string | null;
}

/** Espacios descubiertos (los que se anegan con la lluvia): todos menos el básquet 3 y el gimnasio. */
const DESCUBIERTOS = [
  'esp-01',
  'esp-02',
  'esp-03',
  'esp-04',
  'esp-05',
  'esp-07',
  'esp-08',
  'esp-09',
  'esp-10',
];

export function turnosDeDemo(
  hoy: string,
  ahora: Date,
): {
  fijas: FijaSemilla[];
  bloqueos: BloqueoSemilla[];
  reservas: ReservaSemilla[];
} {
  const dia = (n: number): string => sumarDias(hoy, n);
  const desde = dia(-60);

  const fijas: FijaSemilla[] = [
    // La del PRD: "Grupo de los martes", todos los martes de 21 a 22 en la cancha 2.
    {
      id: 'fij-07',
      espacioId: 'esp-02',
      titular: 'Grupo de los martes',
      dia: 2,
      inicio: '21:00',
      fin: '22:00',
      desde,
      hasta: null,
      activa: true,
    },
    // Una fija de dos horas de un club.
    {
      id: 'fij-08',
      espacioId: 'esp-03',
      titular: 'Club Atlético Villaguay',
      dia: 6,
      inicio: '16:00',
      fin: '18:00',
      desde,
      hasta: null,
      activa: true,
    },
    // Dos fijas que, con el bloqueo y la reserva de abajo, llenan el básquet 1 de mañana.
    {
      id: 'fij-09',
      espacioId: 'esp-04',
      titular: 'Club Juventud',
      dia: diaDeSemana(dia(1)),
      inicio: '15:00',
      fin: '18:00',
      desde,
      hasta: null,
      activa: true,
    },
    {
      id: 'fij-10',
      espacioId: 'esp-04',
      titular: 'Escuelita de básquet',
      dia: diaDeSemana(dia(1)),
      inicio: '18:00',
      fin: '23:00',
      desde,
      hasta: null,
      activa: true,
    },
  ];

  const bloqueos: BloqueoSemilla[] = [
    // Un día entero bloqueado por lluvia: pasado mañana, todas las canchas descubiertas.
    ...DESCUBIERTOS.map((espacioId, i): BloqueoSemilla => ({
      id: `blo-ll${String(i + 1).padStart(2, '0')}`,
      espacioId,
      fecha: dia(2),
      inicio: null,
      fin: null,
      motivo: 'Cancha anegada',
    })),
    // Una grilla completa sin turnos libres (con las fijas y la reserva de esp-04).
    {
      id: 'blo-ll10',
      espacioId: 'esp-04',
      fecha: dia(1),
      inicio: '08:00',
      fin: '15:00',
      motivo: 'Cambio de aros',
    },
    // Un bloqueo parcial.
    {
      id: 'blo-pa01',
      espacioId: 'esp-09',
      fecha: dia(3),
      inicio: '10:00',
      fin: '12:00',
      motivo: 'Mantenimiento de la red',
    },
  ];

  const reserva = (
    id: string,
    espacioId: string,
    usuarioId: string,
    fecha: string,
    inicio: string,
    estado: EstadoReserva,
    cantidadPersonas: number,
  ): ReservaSemilla => ({
    id,
    turnoId: idDeTurno(espacioId, fecha, inicio),
    espacioId,
    usuarioId,
    fecha,
    inicio,
    cantidadPersonas,
    codigoQr: `VGY-${fecha.slice(5, 7)}${fecha.slice(8)}-${inicio.slice(0, 2)}-${textoAleatorio(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}`,
    estado,
    ingresoEn:
      estado === 'cumplida'
        ? new Date(instanteEnZona(fecha, inicio).getTime() - 5 * 60_000)
        : null,
    creadaEn: new Date(ahora.getTime() - 2 * 24 * 60 * 60_000),
    ocupacion:
      estado === 'cancelada' ? null : `${espacioId}|${fecha}|${inicio}`,
  });

  const reservas: ReservaSemilla[] = [
    // La del PRD.
    reserva('res-1180', 'esp-02', 'usr-207', dia(1), '19:00', 'confirmada', 10),
    reserva('res-1181', 'esp-02', 'usr-207', dia(-1), '18:00', 'cumplida', 8),
    reserva('res-1182', 'esp-04', 'usr-207', dia(-3), '20:00', 'ausente', 6),
    reserva('res-1183', 'esp-01', 'usr-207', dia(3), '20:00', 'cancelada', 10),
    // Un turno de hoy, que ya pasó cuando se mira de tarde.
    reserva('res-1195', 'esp-01', 'usr-207', hoy, '08:00', 'confirmada', 10),
    // lleno@demo.ar: tres reservas activas (para ver LIMITE_DE_RESERVAS).
    reserva('res-1190', 'esp-05', 'usr-208', dia(1), '18:00', 'confirmada', 6),
    reserva('res-1191', 'esp-06', 'usr-208', dia(2), '19:00', 'confirmada', 6),
    reserva('res-1192', 'esp-11', 'usr-208', dia(4), '10:00', 'confirmada', 12),
    // El último turno que le faltaba a la grilla completa de esp-04.
    reserva('res-1196', 'esp-04', 'usr-207', dia(1), '23:00', 'confirmada', 6),
  ];

  return { fijas, bloqueos, reservas };
}
