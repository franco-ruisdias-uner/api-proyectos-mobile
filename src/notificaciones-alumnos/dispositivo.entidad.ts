import { Entity, Index, PrimaryColumn } from 'typeorm';
import { ColumnaEnum, ColumnaInstante, ColumnaReferencia } from '../comun/db/columnas.js';
import type { Plataforma } from '../comun/notificaciones/puertos.js';

/** Token de Expo de un teléfono. Uno por token: si cambia de dueño, pasa al último. */
@Entity('dispositivos')
export class DispositivoEntidad {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  tokenExpo: string;

  @Index()
  @ColumnaReferencia()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  registradoEn: Date;
}
