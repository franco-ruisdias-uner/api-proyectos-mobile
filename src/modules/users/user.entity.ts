import { Entity } from 'typeorm';
import type { Rol } from '../../../contract/types.js';
import {
  ColumnaBooleana,
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('usuarios')
export class UsuarioEntidad {
  @ColumnaId()
  id: string;

  /** Como lo escribieron ("L-011"). */
  @ColumnaTexto(20)
  legajo: string;

  /** Normalizado para compararlo sin distinguir mayúsculas (R1). Único. */
  @ColumnaTexto(20, { unique: true })
  legajoBusqueda: string;

  @ColumnaTexto(100)
  nombre: string;

  @ColumnaTexto(100)
  nombreBusqueda: string;

  @ColumnaEnum()
  rol: Rol;

  @ColumnaBooleana({ default: false })
  biometriaActiva: boolean;

  @ColumnaTexto(200)
  hashContrasena: string;

  /** Sube con cada blanqueo de contraseña: invalida los tokens anteriores (R2). */
  @ColumnaEntero({ default: 0 })
  versionSesion: number;

  @ColumnaInstante()
  creadoEn: Date;
}
