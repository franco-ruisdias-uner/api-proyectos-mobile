import { Entity, Index } from 'typeorm';
import type { EstadoReporte } from '../../../contract/types.js';
import {
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';

@Entity('reportes')
@Index(['autorId', 'creadoEn'])
@Index(['estado', 'zonaId'])
export class Reporte {
  @ColumnaId()
  id: string;

  /** GCHU-<año>-<5 dígitos>; el índice único garantiza que no se repita (R4). */
  @ColumnaTexto(20, { unico: true })
  codigo: string;

  @ColumnaRef()
  tipoId: string;

  @ColumnaTextoLargo({ nulo: true })
  descripcion: string | null;

  /** Clave del audio en el almacén, no la URL (AGENTS §8). */
  @ColumnaTexto(120, { nulo: true })
  audioClave: string | null;

  @ColumnaDecimal()
  latitud: number;

  @ColumnaDecimal()
  longitud: number;

  @ColumnaTexto(200)
  direccion: string;

  @ColumnaRef()
  zonaId: string;

  @ColumnaEnum()
  estado: EstadoReporte;

  @ColumnaRef()
  autorId: string;

  @ColumnaRef({ nulo: true })
  cuadrillaId: string | null;

  @ColumnaRef({ nulo: true })
  duplicadoDe: string | null;

  @ColumnaEntero()
  adhesiones: number;

  @ColumnaInstante()
  creadoEn: Date;
}
