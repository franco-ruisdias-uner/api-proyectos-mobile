import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from '../../../contract/types.js';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** El endpoint no pide sesión. Todo lo demás la pide (seguro por defecto, AGENTS §7.3). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Sólo para estos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export interface UsuarioSesion {
  id: string;
  rol: Rol;
}

export type PedidoConSesion = Request & { usuario?: UsuarioSesion };

/** El usuario de la sesión (`sub` y `rol` del token). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioSesion | undefined =>
    ctx.switchToHttp().getRequest<PedidoConSesion>().usuario,
);
