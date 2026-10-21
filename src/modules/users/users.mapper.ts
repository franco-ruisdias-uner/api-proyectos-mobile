import type { Usuario } from '../../../contract/types.js';
import type { UsuarioEntidad } from './user.entity.js';

/** Entidad → Usuario del PRD. Los favoritos viven en su propia tabla y llegan aparte. */
export function aContrato(
  u: UsuarioEntidad,
  espaciosFavoritos: string[],
): Usuario {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    rol: u.rol,
    espaciosFavoritos,
    cancelacionesTardias: u.cancelacionesTardias,
    ausencias: u.ausencias,
  };
}
