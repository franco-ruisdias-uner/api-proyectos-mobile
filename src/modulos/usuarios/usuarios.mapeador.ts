import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { aIsoConZona } from '../../comun/fechas/fechas.js';
import type { Usuario } from './usuario.entidad.js';

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
