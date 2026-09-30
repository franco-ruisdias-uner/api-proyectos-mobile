import { Entity, PrimaryColumn } from 'typeorm';
import type { Coordenadas, Sentido } from '../../../contrato/tipos.js';
import { ColumnaJson, ColumnaTexto } from '../../comun/db/columnas.js';

/** Un recorrido por línea y sentido. El trazado no se filtra: va como JSON (AGENTS §5.3). */
@Entity('recorridos')
export class RecorridoEntidad {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  lineaId: string;

  @PrimaryColumn({ type: 'varchar', length: 20 })
  sentido: Sentido;

  @ColumnaTexto(100)
  destino: string;

  @ColumnaJson()
  trazado: Coordenadas[];
}
