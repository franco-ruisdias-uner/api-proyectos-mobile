import { Entity, Index } from 'typeorm';
import {
  ColumnaBooleano,
  ColumnaId,
  ColumnaRef,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

@Entity('cuadrillas')
@Index(['zonaId', 'activa'])
export class Cuadrilla {
  @ColumnaId()
  id: string;

  @ColumnaTexto(120)
  nombre: string;

  @ColumnaRef()
  zonaId: string;

  @ColumnaTexto(120)
  especialidad: string;

  @ColumnaBooleano()
  activa: boolean;
}
