import { Entity, Index } from 'typeorm';
import {
  ColumnaBooleano,
  ColumnaEntero,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../comun/db/columnas.js';

@Entity('promociones')
@Index(['comercioId'])
@Index(['activa', 'hasta'])
export class Promocion {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  comercioId: string;

  @ColumnaTexto(120)
  titulo: string;

  @ColumnaTextoLargo()
  detalle: string;

  /** Porcentaje entero de 1 a 100, o `null` si la promo no es un descuento. */
  @ColumnaEntero({ nullable: true })
  descuento: number | null;

  @ColumnaInstante()
  desde: Date;

  @ColumnaInstante()
  hasta: Date;

  /** Clave de /archivos (no URL): el mapeador la hace absoluta. */
  @ColumnaTexto(200, { nullable: true })
  imagenClave: string | null;

  @ColumnaBooleano({ default: false })
  soloApp: boolean;

  /** Usos validados (R13). Se recalcula desde la tabla de usos en M6. */
  @ColumnaEntero({ default: 0 })
  usos: number;

  @ColumnaBooleano({ default: true })
  activa: boolean;
}
