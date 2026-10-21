import { Entity, Index } from 'typeorm';
import type { MotivoNovedad } from '../../../contract/types.js';
import {
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../common/db/columns.js';

/**
 * Una novedad cargada en el campo ("perro suelto", "portón cerrado"…). Nada se borra: la vigente de
 * cada suministro y ruta se elige con `elegirVigente` (R13). La foto y la nota de voz se guardan
 * como claves del almacén.
 */
@Entity('novedades')
@Index(['rutaId', 'suministroId'])
@Index(['fechaHora'])
export class NovedadEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(40)
  rutaId: string;

  @ColumnaTexto(40)
  suministroId: string;

  @ColumnaTexto(40)
  lectorId: string;

  @ColumnaEnum()
  motivo: MotivoNovedad;

  // Hasta 500 caracteres (R18): cabe en un varchar de los cuatro motores.
  @ColumnaTexto(500, { nullable: true })
  comentario: string | null;

  @ColumnaTexto(200, { nullable: true })
  audioClave: string | null;

  @ColumnaTexto(200)
  fotoClave: string;

  @ColumnaInstante()
  fechaHora: Date;

  @ColumnaInstante()
  recibidaEn: Date;
}
