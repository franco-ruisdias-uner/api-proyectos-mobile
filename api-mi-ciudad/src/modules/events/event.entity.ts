import { Entity, Index } from 'typeorm';
import {
  ColumnaDecimal,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';
import type { EstadoGuardado } from './rules/agenda.js';

@Entity('eventos')
export class EventoEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(200)
  titulo: string;

  @ColumnaTextoLargo()
  descripcion: string;

  @Index()
  @ColumnaTexto(40, { nulo: true })
  lugarId: string | null;

  @ColumnaTexto(200, { nulo: true })
  direccionLibre: string | null;

  @ColumnaDecimal({ nulo: true })
  latitud: number | null;

  @ColumnaDecimal({ nulo: true })
  longitud: number | null;

  @Index()
  @ColumnaInstante()
  inicio: Date;

  @ColumnaInstante({ nulo: true })
  fin: Date | null;

  /** Interno (D3): el fin, o las 23:59 del día de `inicio`. Sirve para filtrar y para `finalizado`. */
  @Index()
  @ColumnaInstante()
  finEfectivo: Date;

  /** Clave del almacén; el mapeador la convierte en URL. */
  @ColumnaTexto(200, { nulo: true })
  imagenClave: string | null;

  @ColumnaEntero({ nulo: true })
  precio: number | null;

  /** `programado`, `suspendido` o `cancelado`: `finalizado` no se guarda (D3). */
  @ColumnaEnum()
  estado: EstadoGuardado;
}
