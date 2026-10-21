import type { Usuario } from '../../../contract/types.js';
import type { UsuarioEntidad } from './user.entity.js';

/** Única salida de un usuario hacia el cliente: sin hash, sin rol, sin fechas internas. */
export function aContrato(
  usuario: UsuarioEntidad,
  favoritas: { lineas: string[]; paradas: string[] },
): Usuario {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    lineasFavoritas: favoritas.lineas,
    paradasFavoritas: favoritas.paradas,
    avisosActivos: usuario.avisosActivos,
    tema: usuario.tema,
  };
}
