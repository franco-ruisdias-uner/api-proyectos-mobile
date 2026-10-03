import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import type { Usuario } from './usuario.entidad.js';

export interface ListasDeUsuario {
  favoritos: string[];
  rubrosDeInteres: string[];
}

/** Entidad → `Usuario` del PRD. Nunca sale el hash de la contraseña. */
export function aContrato(u: Usuario, listas: ListasDeUsuario): UsuarioContrato {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    comercioId: u.comercioId ?? null,
    favoritos: listas.favoritos,
    rubrosDeInteres: listas.rubrosDeInteres,
    avisosActivos: u.avisosActivos,
  };
}
