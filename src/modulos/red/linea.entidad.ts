import { Entity } from 'typeorm';
import {
  ColumnaBooleano,
  ColumnaEntero,
  ColumnaId,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

@Entity('lineas')
export class LineaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(10)
  numero: string;

  /** Interna: el número como entero, para ordenar "2" antes que "14". */
  @ColumnaEntero()
  numeroOrden: number;

  @ColumnaTexto(100)
  nombre: string;

  @ColumnaTexto(9)
  color: string;

  @ColumnaTexto(100)
  empresa: string;

  @ColumnaBooleano()
  activa: boolean;
}
