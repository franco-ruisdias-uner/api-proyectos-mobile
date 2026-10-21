import { Entity, Index } from 'typeorm';
import type { MotivoDemora } from '../../../contract/types.js';
import {
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaReferencia,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';

/** Un reporte de demora de un pasajero. `confirmaciones` se recalcula desde `confirmaciones_demora`. */
@Entity('reportes_demora')
@Index(['paradaId', 'fechaHora'])
@Index(['lineaId', 'fechaHora'])
export class ReporteDemoraEntidad {
  @ColumnaId()
  id: string;

  @ColumnaReferencia()
  lineaId: string;

  @ColumnaReferencia()
  paradaId: string;

  @ColumnaReferencia()
  usuarioId: string;

  @ColumnaEnum()
  motivo: MotivoDemora;

  @ColumnaTextoLargo({ nullable: true })
  comentario: string | null;

  /** La clave del archivo (AGENTS §8), no la URL. */
  @ColumnaTexto(200, { nullable: true })
  fotoClave: string | null;

  @ColumnaEntero()
  confirmaciones: number;

  /** Cuándo pasó (lo manda el teléfono), no cuándo se subió. */
  @ColumnaInstante()
  fechaHora: Date;
}
