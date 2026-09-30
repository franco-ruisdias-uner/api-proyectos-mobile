import { Entity } from 'typeorm';
import type { Tema } from '../../../contrato/tipos.js';
import type { Rol } from '../../comun/auth/roles.js';
import {
  ColumnaBooleano,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

@Entity('usuarios')
export class UsuarioEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(100)
  nombre: string;

  /** Normalizado (minúsculas, sin espacios alrededor): así es único sin distinguir mayúsculas. */
  @ColumnaTexto(200, { unique: true })
  email: string;

  @ColumnaTexto(200)
  contrasenaHash: string;

  /** Interno (D1): no sale en el Usuario del PRD. */
  @ColumnaEnum()
  rol: Rol;

  @ColumnaBooleano()
  avisosActivos: boolean;

  @ColumnaEnum()
  tema: Tema;

  @ColumnaInstante()
  creadoEn: Date;
}
