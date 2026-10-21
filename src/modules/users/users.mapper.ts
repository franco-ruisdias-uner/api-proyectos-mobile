import type { Usuario } from '../../../contract/types.js';
import type { UsuarioEntidad } from './user.entity.js';

/**
 * Entidad → `Usuario` del PRD. `rutasAsignadas` se calcula (ids de las rutas `asignada`
 * o `en_curso` del lector, por número de ruta) y la pasa el servicio.
 */
export function aContrato(
  usuario: UsuarioEntidad,
  rutasAsignadas: string[],
): Usuario {
  return {
    id: usuario.id,
    legajo: usuario.legajo,
    nombre: usuario.nombre,
    rol: usuario.rol,
    biometriaActiva: usuario.biometriaActiva,
    rutasAsignadas,
  };
}
