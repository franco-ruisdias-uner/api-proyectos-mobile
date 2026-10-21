import { Entity, Index } from 'typeorm';
import type { Audioguia } from '../../../contract/types.js';
import {
  ColumnaBooleano,
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaJson,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';
import type { HorarioConTemporada } from './place-to-load.js';

@Entity('lugares')
export class LugarEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(200)
  nombre: string;

  /** Interno: el nombre normalizado para buscar (AGENTS §5.5). Lo mantiene el servicio. */
  @ColumnaTexto(200)
  nombreBusqueda: string;

  @Index()
  @ColumnaTexto(40)
  categoriaId: string;

  @ColumnaTexto(300)
  descripcionCorta: string;

  @ColumnaTextoLargo()
  descripcion: string;

  @Index()
  @ColumnaDecimal()
  latitud: number;

  @ColumnaDecimal()
  longitud: number;

  @ColumnaTexto(200)
  direccion: string;

  /** Claves del almacén; el mapeador las convierte en URLs. */
  @ColumnaJson()
  imagenes: string[];

  /** Todos los tramos, con su temporada (D1). El mapeador devuelve los vigentes. */
  @ColumnaJson()
  horarios: HorarioConTemporada[];

  /** Interno: algún tramo depende de la temporada (para `actualizadoDesde`, D1). */
  @ColumnaBooleano()
  tieneTemporadas: boolean;

  @ColumnaTexto(40, { nulo: true })
  telefono: string | null;

  @ColumnaTexto(500, { nulo: true })
  sitioWeb: string | null;

  @ColumnaEntero({ nulo: true })
  precioEntrada: number | null;

  @ColumnaTexto(200, { nulo: true })
  audioguiaClave: string | null;

  @ColumnaEntero({ nulo: true })
  audioguiaDuracionSegundos: number | null;

  @ColumnaEnum({ nulo: true })
  audioguiaIdioma: Audioguia['idioma'] | null;

  @ColumnaTexto(60, { nulo: true, unico: true })
  codigoQr: string | null;

  @ColumnaBooleano()
  accesible: boolean;

  @ColumnaBooleano()
  activo: boolean;

  @Index()
  @ColumnaInstante()
  actualizadoEn: Date;
}
