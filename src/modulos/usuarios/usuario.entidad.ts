import { Entity } from 'typeorm';
import type { Rol } from '../../../contrato/tipos.js';
import {
  ColumnaBooleano,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaRef,
  ColumnaTexto,
} from '../../comun/db/columnas.js';

@Entity('usuarios')
export class Usuario {
  @ColumnaId()
  id: string;

  @ColumnaTexto(120)
  nombre: string;

  /** Normalizado (minúsculas, sin espacios): el índice único no distingue mayúsculas. */
  @ColumnaTexto(254, { unico: true })
  email: string;

  @ColumnaTexto(200)
  contrasenaHash: string;

  @ColumnaTexto(40, { nulo: true })
  telefono: string | null;

  @ColumnaEnum()
  rol: Rol;

  @ColumnaRef({ nulo: true })
  zonaId: string | null;

  @ColumnaBooleano()
  avisosActivos: boolean;

  @ColumnaInstante()
  creadoEn: Date;
}
