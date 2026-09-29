import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol } from '../../../contrato/tipos.js';
import type { Usuario } from '../../modulos/usuarios/usuario.entidad.js';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** Marca un endpoint (o un controlador entero) como accesible sin sesión. */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Exige uno de estos roles. Sin el rol: 403 SIN_PERMISO. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export interface PedidoConUsuario {
  usuario?: Usuario;
}

/** El usuario de la sesión (lo carga el guard de autenticación). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): Usuario => {
    const usuario = ctx.switchToHttp().getRequest<PedidoConUsuario>().usuario;
    if (!usuario) throw new Error('UsuarioActual en un endpoint sin sesión');
    return usuario;
  },
);
