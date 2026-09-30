import { Entity, Index, PrimaryColumn } from 'typeorm';
import { ColumnaEnum, ColumnaInstante, ColumnaReferencia } from '../../comun/db/columnas.js';

export const PLATAFORMAS = ['android', 'ios'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

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
