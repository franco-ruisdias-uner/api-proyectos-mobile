import { Entity } from 'typeorm';
import type { Preferencias } from '../../../contrato/tipos.js';
import {
  ColumnaEnum,
  ColumnaId,
  ColumnaInstante,
  ColumnaJson,
  ColumnaTexto,
} from '../../comun/db/columnas.js';
import type { Rol } from '../../comun/auth/decoradores.js';

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
}
