import { Entity } from 'typeorm';
import { ColumnaEntero, ColumnaId, ColumnaTexto } from '../../common/db/columns.js';

@Entity('rubros')
export class Rubro {
  @ColumnaId()
  id: string;

  @ColumnaTexto(60)
  nombre: string;

  @ColumnaTexto(40)
  icono: string;

  @ColumnaTexto(9)
  color: string;

  @ColumnaEntero()
  orden: number;
}
