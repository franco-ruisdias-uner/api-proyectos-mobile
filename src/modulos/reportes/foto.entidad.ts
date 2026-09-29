import { Entity, Index } from 'typeorm';
import {
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaRef,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

export type MomentoFoto = 'problema' | 'arreglo';

@Entity('fotos')
@Index(['reporteId', 'orden'])
export class FotoDeReporte {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  reporteId: string;

  /** Clave del archivo en el almacén, no la URL (AGENTS §8). */
  @ColumnaTexto(120)
  clave: string;

  @ColumnaEnum()
  momento: MomentoFoto;

  /** Posición dentro del reporte, desde 1. */
  @ColumnaEntero()
  orden: number;
}
