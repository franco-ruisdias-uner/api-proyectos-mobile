import { Entity, Index, PrimaryColumn } from 'typeorm';
import { ColumnaEntero } from '../../comun/db/columnas.js';

// Favoritos en tablas propias (AGENTS §5.3): se filtran para mandar push a quienes tienen
// una línea como favorita. `orden` guarda el orden de alta (R16).

@Entity('lineas_favoritas')
export class LineaFavoritaEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  usuarioId: string;

  @Index()
  @PrimaryColumn({ type: 'varchar', length: 40 })
  lineaId: string;

  @ColumnaEntero()
  orden: number;
}

@Entity('paradas_favoritas')
export class ParadaFavoritaEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  usuarioId: string;

  @Index()
  @PrimaryColumn({ type: 'varchar', length: 40 })
  paradaId: string;

  @ColumnaEntero()
  orden: number;
}
