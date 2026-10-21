import { Entity } from 'typeorm';
import type { Rol } from '../../../contract/types.js';
import {
  ColumnaBooleano,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
} from '../../common/db/columns.js';

@Entity('usuarios')
export class Usuario {
  @ColumnaId()
  id: string;

  @ColumnaTexto(80)
  nombre: string;

  /** Normalizado en minúsculas: único sin distinguir mayúsculas. */
  @ColumnaTexto(254, { unique: true })
  email: string;

  @ColumnaTexto(200)
  hashContrasena: string;

  @ColumnaEnum()
  rol: Rol;

  /** Sólo en cuentas de comercio. */
  @ColumnaRef({ nullable: true })
  comercioId: string | null;

  @ColumnaBooleano({ default: true })
  avisosActivos: boolean;

  @ColumnaInstante()
  creadoEn: Date;
}
