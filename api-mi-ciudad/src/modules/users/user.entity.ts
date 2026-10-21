import { Entity } from 'typeorm';
import type { Preferencias } from '../../../contract/types.js';
import {
  ColumnaEntero,
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaJson,
  ColumnaTexto,
} from '../../common/db/columns.js';
import type { Rol } from '../../common/auth/decorators.js';

@Entity('usuarios')
export class UsuarioEntidad {
  @ColumnaId()
  id: string;

  @ColumnaTexto(100)
  nombre: string;

  /** Guardado en minúsculas: el índice único no distingue mayúsculas en ningún motor. */
  @ColumnaTexto(254, { unico: true })
  email: string;

  @ColumnaTexto(200)
  hashContrasena: string;

  /** Interno: el `Usuario` del PRD no tiene rol (D2). */
  @ColumnaEnum()
  rol: Rol;

  /** Clave del archivo en el almacén; el mapeador la convierte en URL. */
  @ColumnaTexto(200, { nulo: true })
  avatarClave: string | null;

  @ColumnaInstante()
  creadoEn: Date;

  @ColumnaJson()
  preferencias: Preferencias;

  /**
   * Interno. Sube en cada `PATCH /yo`: dos cambios simultáneos de preferencias no se pisan
   * (control optimista, portable a los cuatro motores; ver `UsuariosServicio.actualizar`).
   */
  @ColumnaEntero()
  version: number;
}
