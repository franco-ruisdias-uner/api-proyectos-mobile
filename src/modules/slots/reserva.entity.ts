import { Entity } from 'typeorm';
import type { EstadoReserva } from '../../../contract/types.js';
import {
  ColumnaDia,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaHora,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('reservas')
export class ReservaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(80)
  turnoId: string;

  @ColumnaRef()
  espacioId: string;

  @ColumnaRef()
  usuarioId: string;

  /** Día y hora del turno, para buscar sin desarmar el `turnoId`. */
  @ColumnaDia()
  fecha: string;

  @ColumnaHora()
  inicio: string;

  @ColumnaEntero()
  cantidadPersonas: number;

  @ColumnaTexto(40, { unique: true })
  codigoQr: string;

  @ColumnaEnum()
  estado: EstadoReserva;

  @ColumnaInstante({ nullable: true })
  ingresoEn: Date | null;

  @ColumnaInstante()
  creadaEn: Date;

  /**
   * "<espacioId>|<fecha>|<inicio>" mientras la reserva ocupa el turno y NULL si está
   * cancelada. Su índice único garantiza que no haya dos reservas en el mismo turno (R8).
   */
  @ColumnaTexto(100, { unique: true, nullable: true })
  ocupacion: string | null;
}
