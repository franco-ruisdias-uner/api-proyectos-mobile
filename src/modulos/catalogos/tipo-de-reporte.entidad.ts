import { Entity } from 'typeorm';
import { ColumnaId, ColumnaTexto } from '../../comun/db/columnas.js';

@Entity('tipos_de_reporte')
export class TipoDeReporte {
  @ColumnaId()
  id: string;

  @ColumnaTexto(80)
  nombre: string;

  /** Nombre de un ícono de Ionicons. */
  @ColumnaTexto(60)
  icono: string;

  /** Color hexadecimal, p. ej. "#E67E22". */
  @ColumnaTexto(9)
  color: string;

  @ColumnaTexto(120)
  areaResponsable: string;
}
