import { Entity, Index } from 'typeorm';
import { ColumnaId, ColumnaInstante, ColumnaRef, ColumnaTexto } from '../../comun/db/columnas.js';

/**
 * Un código por vecino y promo (D9): el índice único lo garantiza aun con pedidos simultáneos
 * (R11). El código también es único: es lo que el comercio escanea (D8).
 */
@Entity('usos_de_promocion')
@Index(['promocionId', 'usuarioId'], { unique: true })
@Index(['codigo'], { unique: true })
@Index(['usuarioId', 'generadoEn'])
export class UsoDePromocion {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  promocionId: string;

  @ColumnaRef()
  usuarioId: string;

  @ColumnaTexto(20)
  codigo: string;

  /** Cuándo el vecino pidió el código (interno: el contrato no lo trae). */
  @ColumnaInstante()
  generadoEn: Date;

  /** `null` hasta que el comercio lo valida en el mostrador (R12). */
  @ColumnaInstante({ nullable: true })
  validadoEn: Date | null;
}
