import { Entity } from 'typeorm';
import type { Rol } from '../../../contract/types.js';
import {
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

  @ColumnaTexto(80)
  nombre: string;

  /** Normalizado (minúsculas, sin espacios): el índice único no distingue mayúsculas. */
  @ColumnaTexto(254, { unique: true })
  email: string;

  @ColumnaTexto(30)
  telefono: string;

  @ColumnaEnum()
  rol: Rol;

  /** Nunca sale en una respuesta ni en un log. */
  @ColumnaTexto(200)
  contrasenaHash: string;

  @ColumnaEntero({ default: 0 })
  cancelacionesTardias: number;

  @ColumnaEntero({ default: 0 })
  ausencias: number;

  @ColumnaInstante()
  creadoEn: Date;
}
