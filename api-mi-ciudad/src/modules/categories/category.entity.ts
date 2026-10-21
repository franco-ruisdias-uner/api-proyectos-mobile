import { Entity } from 'typeorm';
import { ColumnaEntero, ColumnaId, ColumnaTexto } from '../../common/db/columns.js';

@Entity('categorias')
export class CategoriaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(100)
  nombre: string;

  /** Nombre de un ícono de Ionicons. */
  @ColumnaTexto(60)
  icono: string;

  /** Hexadecimal, `#RRGGBB`. */
  @ColumnaTexto(9)
  color: string;

  @ColumnaEntero()
  orden: number;
}
