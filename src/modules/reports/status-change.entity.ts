import { Entity, Index } from 'typeorm';
import type { EstadoReporte } from '../../../contract/types.js';
import {
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';

@Entity('cambios_de_estado')
@Index(['reporteId', 'fechaHora'])
export class CambioDeEstado {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  reporteId: string;

  @ColumnaEnum()
  estado: EstadoReporte;

  @ColumnaTextoLargo({ nulo: true })
  comentario: string | null;

  @ColumnaRef({ nulo: true })
  operadorId: string | null;

  @ColumnaInstante()
  fechaHora: Date;

  /** Orden de los cambios de un mismo reporte (desempata fechas iguales). Interno. */
  @ColumnaEntero()
  secuencia: number;
}
