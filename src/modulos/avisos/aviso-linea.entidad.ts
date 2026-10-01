import { Entity, Index, PrimaryColumn } from 'typeorm';
import { ColumnaEntero } from '../../comun/db/columnas.js';

/**
 * Líneas de un aviso, en tabla propia porque se filtra por línea (AGENTS §5.3) y se buscan
 * los favoritos de esas líneas para la push. `orden` conserva el orden en que se cargaron.
 */
@Entity('aviso_lineas')
export class AvisoLineaEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  avisoId: string;

  @Index()
  @PrimaryColumn({ type: 'varchar', length: 40 })
  lineaId: string;

  @ColumnaEntero()
  orden: number;
}
