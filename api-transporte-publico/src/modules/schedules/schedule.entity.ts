import { Entity, Index } from 'typeorm';
import type { Sentido, TipoDeDia } from '../../../contract/types.js';
import { ColumnaEnum, ColumnaHora, ColumnaId, ColumnaReferencia } from '../../common/db/columns.js';

/** Una fila de la tabla de horarios: una línea pasa por una parada a una hora (R5, R9). */
@Entity('horarios')
@Index(['paradaId', 'lineaId', 'tipoDeDia'])
@Index(['lineaId', 'paradaId'])
export class HorarioEntidad {
  @ColumnaId()
  id: string;

  @ColumnaReferencia()
  lineaId: string;

  @ColumnaReferencia()
  paradaId: string;

  @ColumnaEnum()
  sentido: Sentido;

  @ColumnaEnum()
  tipoDeDia: TipoDeDia;

  /** "HH:MM" de 24 horas, con cero adelante. */
  @ColumnaHora()
  hora: string;
}
