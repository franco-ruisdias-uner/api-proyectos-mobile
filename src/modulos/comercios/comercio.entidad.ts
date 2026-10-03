import { Entity, Index } from 'typeorm';
import type { Horario } from '../../../contrato/tipos.js';
import {
  ColumnaBooleano,
  ColumnaDecimal,
  ColumnaDia,
  ColumnaEntero,
  ColumnaId,
  ColumnaJson,
  ColumnaRef,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../comun/db/columnas.js';

@Entity('comercios')
@Index(['activo', 'rubroId'])
export class Comercio {
  @ColumnaId()
  id: string;

  @ColumnaTexto(120)
  nombre: string;

  /** Columna gemela de `nombre` para buscar sin tildes ni mayúsculas (AGENTS §5.5). */
  @ColumnaTexto(120)
  nombreBusqueda: string;

  @ColumnaRef()
  rubroId: string;

  @ColumnaTextoLargo()
  descripcion: string;

  @ColumnaTextoLargo()
  descripcionBusqueda: string;

  @ColumnaTexto(160)
  direccion: string;

  @ColumnaDecimal()
  latitud: number;

  @ColumnaDecimal()
  longitud: number;

  @ColumnaTexto(40, { nullable: true })
  telefono: string | null;

  @ColumnaTexto(20, { nullable: true })
  whatsapp: string | null;

  @ColumnaTexto(40, { nullable: true })
  instagram: string | null;

  /** Claves de /archivos (no URLs): el mapeador las hace absolutas. */
  @ColumnaJson()
  imagenes: string[];

  @ColumnaTexto(200, { nullable: true })
  videoClave: string | null;

  /** Un elemento por tramo (ESPECIFICACION R2). */
  @ColumnaJson()
  horarios: Horario[];

  @ColumnaJson()
  mediosDePago: string[];

  @ColumnaDecimal({ default: 0 })
  puntaje: number;

  @ColumnaEntero({ default: 0 })
  cantidadResenas: number;

  @ColumnaBooleano({ default: true })
  activo: boolean;

  /** D2: último día de cierre por vacaciones ("AAAA-MM-DD"). Interna: el contrato no la tiene. */
  @ColumnaDia({ nullable: true })
  cerradoHasta: string | null;
}
