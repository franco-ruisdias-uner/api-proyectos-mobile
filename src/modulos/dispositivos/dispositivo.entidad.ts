import { Entity, Index, PrimaryColumn } from 'typeorm';
import {
  ColumnaEnum,
  ColumnaInstante,
  ColumnaTexto,
} from '../../comun/db/columnas.js';
import type { Plataforma } from '../../comun/notificaciones/puertos.js';

@Entity('dispositivos')
export class DispositivoEntidad {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  tokenExpo: string;

  @Index()
  @ColumnaTexto(40)
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  actualizadoEn: Date;
}
