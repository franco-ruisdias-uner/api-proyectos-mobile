import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Rol } from '../../../contract/types.js';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** Marca un endpoint como público: no pide sesión (AGENTS §7.3, seguro por defecto). */
export const Publico = (): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_PUBLICO, true);

/** Restringe un endpoint a ciertos roles. */
export const Roles = (...roles: Rol[]): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_ROLES, roles);

/** Quién hizo el pedido, según el token. */
export interface UsuarioSesion {
  id: string;
  rol: Rol;
}

export const SesionActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioSesion => {
    const req = ctx.switchToHttp().getRequest<{ usuario?: UsuarioSesion }>();
    if (!req.usuario)
      throw new Error('SesionActual usado en un endpoint público.');
    return req.usuario;
  },
);
