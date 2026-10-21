import { Entity, PrimaryColumn } from 'typeorm';
import { ColumnaInstante } from '../../common/db/columns.js';

/** Quién reportó qué: la clave compuesta hace idempotente el reporte (R10). */
@Entity('reportes_de_resenas')
export class ReporteDeResena {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  resenaId: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  usuarioId: string;

  @ColumnaInstante()
  creadoEn: Date;
}
