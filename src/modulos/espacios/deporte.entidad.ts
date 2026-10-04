import { Entity } from 'typeorm';
import { ColumnaId, ColumnaTexto } from '../../comun/db/columnas.js';

@Entity('deportes')
export class DeporteEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(60)
  nombre: string;

  /** Nombre de un ícono de Ionicons. */
  @ColumnaTexto(60)
  icono: string;

  /** Color hexadecimal ("#2E7D32"). */
  @ColumnaTexto(9)
  color: string;
}
