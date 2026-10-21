import type { Usuario as UsuarioContrato } from '../../../contract/types.js';
import { aIsoConZona } from '../../common/dates/dates.js';
import type { Usuario } from './user.entity.js';

/** Única salida de un usuario hacia el cliente. Nunca expone el hash de la contraseña. */
export function aUsuario(u: Usuario): UsuarioContrato {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    rol: u.rol,
    zonaId: u.zonaId,
    avisosActivos: u.avisosActivos,
    creadoEn: aIsoConZona(u.creadoEn),
  };
}
