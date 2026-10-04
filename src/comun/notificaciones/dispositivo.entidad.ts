import { Entity, Index } from 'typeorm';
import {
  ColumnaEnum,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
} from '../db/columnas.js';
import type { Plataforma } from './puertos.js';

/** Un teléfono que recibe push. El token de Expo es único: si cambia de usuario, se mueve. */
@Entity('dispositivos')
export class DispositivoEntidad {
  @ColumnaTexto(200, { primary: true })
  tokenExpo: string;

  @Index()
  @ColumnaRef()
  usuarioId: string;

  @ColumnaEnum()
  plataforma: Plataforma;

  @ColumnaInstante()
  actualizadoEn: Date;
}
