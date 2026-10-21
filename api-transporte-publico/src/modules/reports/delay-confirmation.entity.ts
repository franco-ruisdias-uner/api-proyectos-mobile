import { Entity, PrimaryColumn } from 'typeorm';
import { ColumnaInstante } from '../../common/db/columns.js';

/** Quién confirmó qué reporte: la clave primaria garantiza una confirmación por persona (R15). */
@Entity('confirmaciones_demora')
export class ConfirmacionDemoraEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  reporteId: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  usuarioId: string;

  @ColumnaInstante()
  creadaEn: Date;
}
