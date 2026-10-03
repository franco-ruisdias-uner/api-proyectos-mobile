import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../../contrato/tipos.js';
import { ErrorApi } from '../errores/error-api.js';
import { CLAVE_PUBLICO, CLAVE_ROLES, type PedidoConSesion } from './decoradores.js';
import { Tokens } from './tokens.js';

/**
 * Guard global: exige `Authorization: Bearer <token>` salvo en lo marcado con @Publico().
 * En un endpoint público, si viene un token válido, igual se lee (sirve para saber quién mira).
 */
@Injectable()
export class GuardSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: Tokens,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    const publico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos);
    const req = ctx.switchToHttp().getRequest<PedidoConSesion>();

    const m = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '');
    const usuario = m ? this.tokens.verificar(m[1].trim()) : null;
    if (usuario) req.usuario = usuario;

    if (publico) return true;
    if (!usuario) throw new ErrorApi('NO_AUTENTICADO');

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, objetivos);
    if (roles && !roles.includes(usuario.rol)) throw new ErrorApi('SIN_PERMISO');
    return true;
  }
}
