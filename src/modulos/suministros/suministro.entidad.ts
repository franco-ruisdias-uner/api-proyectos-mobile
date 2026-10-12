import { Entity } from 'typeorm';
import type { Categoria } from '../../../contrato/tipos.js';
import {
  ColumnaBooleana,
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

@Entity('suministros')
export class SuministroEntidad {
  @ColumnaId()
  id: string;

  /** Con ceros a la izquierda ("004120"): texto, se busca y se ordena como texto. */
  @ColumnaTexto(20, { unique: true })
  numero: string;

  @ColumnaTexto(150)
  titular: string;

  @ColumnaTexto(150)
  titularBusqueda: string;

  @ColumnaTexto(200)
  direccion: string;

  @ColumnaTexto(200)
  direccionBusqueda: string;

  @ColumnaDecimal()
  latitud: number;

  @ColumnaDecimal()
  longitud: number;

  @ColumnaEnum()
  categoria: Categoria;

  /** Un medidor por suministro. */
  @ColumnaTexto(40, { unique: true })
  medidorId: string;

  @ColumnaEntero({ nullable: true })
  lecturaAnterior: number | null;

  @ColumnaInstante({ nullable: true })
  fechaLecturaAnterior: Date | null;

  /** En m³ reales, ya multiplicados (D12). */
  @ColumnaDecimal({ nullable: true })
  consumoPromedio: number | null;

  @ColumnaBooleana({ default: true })
  activo: boolean;
}
