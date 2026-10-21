import { Entity, Index, Unique } from 'typeorm';
import type { EstadoRuta } from '../../../contract/types.js';
import {
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../common/db/columns.js';

/** Una ruta de lectura. Su id es `rut-<numero>-<bimestre>`. Los suministros van en `rutas_suministros`. */
@Entity('rutas')
@Unique(['numero', 'bimestre'])
export class RutaEntidad {
  @ColumnaId()
  id: string;

  /** Sólo dígitos ("07"). */
  @ColumnaTexto(10)
  numero: string;

  @ColumnaTexto(100)
  nombre: string;

  /** "AAAA-NN", con NN de 01 a 06 (D9). */
  @ColumnaTexto(7)
  bimestre: string;

  @Index()
  @ColumnaTexto(40)
  lectorId: string;

  @ColumnaEnum()
  estado: EstadoRuta;

  @ColumnaInstante({ nullable: true })
  descargadaEn: Date | null;

  @ColumnaInstante({ nullable: true })
  cerradaEn: Date | null;
}
