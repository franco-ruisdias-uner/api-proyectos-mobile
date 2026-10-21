import { Entity, Index } from 'typeorm';
import type { Sentido } from '../../../contract/types.js';
import {
  ColumnaBooleano,
  ColumnaDoble,
  ColumnaEnum,
  ColumnaId,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('paradas')
export class ParadaEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(120)
  nombre: string;

  /** Gemela de `nombre`, normalizada, para buscar (AGENTS §5.5). */
  @ColumnaTexto(120)
  nombreBusqueda: string;

  @Index()
  @ColumnaDoble()
  latitud: number;

  @Index()
  @ColumnaDoble()
  longitud: number;

  @ColumnaEnum()
  sentido: Sentido;

  @ColumnaBooleano()
  refugio: boolean;

  /** Único; varios `NULL` conviven en los cuatro motores. */
  @ColumnaTexto(60, { nullable: true, unique: true })
  codigoQr: string | null;
}
