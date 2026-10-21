import { Entity, Index, PrimaryColumn } from 'typeorm';
import type { Sentido } from '../../../contract/types.js';

/**
 * Las paradas de cada recorrido, en orden de paso. Es tabla propia porque se filtra
 * (paradas de una línea) y de acá sale `Parada.lineaIds` (R2): no se guarda aparte.
 */
@Entity('recorridos_paradas')
export class RecorridoParadaEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  lineaId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  sentido: Sentido;

  @PrimaryColumn({ type: 'int' })
  orden: number;

  @Index()
  @PrimaryColumn({ type: 'varchar', length: 40 })
  paradaId: string;
}
