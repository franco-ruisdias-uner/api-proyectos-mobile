import { Entity, PrimaryColumn } from 'typeorm';
import { ColumnaTexto } from '../../comun/db/columnas.js';

/** Un feriado nacional (D2). La fecha "AAAA-MM-DD" es la clave: no hay dos el mismo día. */
@Entity('feriados')
export class FeriadoEntidad {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  fecha: string;

  @ColumnaTexto(120)
  nombre: string;
}
