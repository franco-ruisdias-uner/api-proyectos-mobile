import { Entity, Index } from 'typeorm';
import {
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
} from '../../comun/db/columnas.js';

/**
 * Un vecino que se suma a un reporte ajeno (PRD §3). El índice único garantiza «una vez por
 * vecino y reporte» aunque lleguen dos pedidos a la vez (R10). `Reporte.adhesiones` se recalcula
 * desde esta tabla.
 */
@Entity('adhesiones')
@Index(['reporteId', 'usuarioId'], { unique: true })
export class Adhesion {
  @ColumnaId()
  id: string;

  @ColumnaRef()
  reporteId: string;

  @ColumnaRef()
  usuarioId: string;

  @ColumnaInstante()
  creadoEn: Date;
}
