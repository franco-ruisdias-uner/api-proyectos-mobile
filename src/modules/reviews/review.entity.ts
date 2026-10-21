import { Entity, Index } from 'typeorm';
import {
  ColumnaBooleano,
  ColumnaEntero,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTextoLargo,
} from '../../common/db/columns.js';

/** Una por vecino y comercio: el índice único lo garantiza aun con pedidos simultáneos (R7). */
@Entity('resenas')
@Index(['comercioId', 'usuarioId'], { unique: true })
@Index(['comercioId', 'creadaEn'])
export class Resena {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  comercioId: string;

  @ColumnaRef()
  usuarioId: string;

  @ColumnaEntero()
  estrellas: number;

  @ColumnaTextoLargo()
  comentario: string;

  @ColumnaTextoLargo({ nullable: true })
  respuesta: string | null;

  /** Se mantiene al reportar; la reseña sigue visible (D6). */
  @ColumnaBooleano({ default: false })
  reportada: boolean;

  /** Cuándo se escribió (la manda el cliente si estaba sin señal), no cuándo se subió. */
  @ColumnaInstante()
  creadaEn: Date;
}
