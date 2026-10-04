import { Entity } from 'typeorm';
import {
  ColumnaBooleana,
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaId,
  ColumnaJson,
  ColumnaRef,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../comun/db/columnas.js';

@Entity('espacios')
export class EspacioEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(120)
  nombre: string;

  @ColumnaRef({ name: 'deporteId' })
  deporteId: string;

  @ColumnaTexto(120)
  complejo: string;

  /** `complejo` normalizado: el filtro busca acá (AGENTS §5.5). */
  @ColumnaTexto(120)
  complejoBusqueda: string;

  @ColumnaTexto(80)
  superficie: string;

  @ColumnaBooleana()
  techado: boolean;

  @ColumnaBooleana()
  iluminacion: boolean;

  @ColumnaEntero()
  capacidad: number;

  @ColumnaEntero()
  precioPorHora: number;

  @ColumnaDecimal()
  latitud: number;

  @ColumnaDecimal()
  longitud: number;

  /** Claves de archivo (no URLs): el mapeador las hace absolutas. */
  @ColumnaJson()
  imagenes: string[];

  /** Clave de archivo, o null si el espacio no tiene video. */
  @ColumnaTexto(200, { nullable: true })
  videoUrl: string | null;

  @ColumnaTextoLargo()
  reglas: string;

  @ColumnaBooleana()
  activo: boolean;
}
