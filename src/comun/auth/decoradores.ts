import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Rol } from './roles.js';

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** El endpoint no pide sesión. Todo lo demás la pide (seguro por defecto, AGENTS §7.3). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Sólo para esos roles; con otro rol → SIN_PERMISO (403). */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

export interface UsuarioDeSesion {
  id: string;
  rol: Rol;
}

export type PedidoConSesion = Request & { usuario?: UsuarioDeSesion };

/** El usuario de la sesión del pedido (sólo en endpoints con sesión). */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext): UsuarioDeSesion => {
    const pedido = contexto.switchToHttp().getRequest<PedidoConSesion>();
    if (!pedido.usuario) throw new Error('UsuarioActual usado en un endpoint público');
    return pedido.usuario;
  },
);
