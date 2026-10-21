import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';

export type Rol = 'turista' | 'admin';

export interface UsuarioAutenticado {
  id: string;
  rol: Rol;
}

export const CLAVE_PUBLICO = 'publico';
export const CLAVE_ROLES = 'roles';

/** El endpoint no pide sesión (AGENTS §7.3: todo lo demás, sí). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** El endpoint pide alguno de estos roles. */
export const Roles = (...roles: Rol[]) => SetMetadata(CLAVE_ROLES, roles);

/** El usuario de la sesión, puesto por el guard. */
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest<{ usuario: UsuarioAutenticado }>().usuario,
);
