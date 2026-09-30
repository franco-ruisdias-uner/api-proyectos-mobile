import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorDeApi } from '../errores/error-de-api.js';
import { CLAVE_PUBLICO, CLAVE_ROLES, type PedidoConSesion } from './decoradores.js';
import type { Rol } from './roles.js';
import { Sesiones } from './sesiones.js';

/** Guard global: exige sesión salvo @Publico(), y el rol si hay @Roles(). */
@Injectable()
export class Guardia implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesiones: Sesiones,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) return true;

    const pedido = contexto.switchToHttp().getRequest<PedidoConSesion>();
    const [tipo, token] = (pedido.headers.authorization ?? '').split(' ');
    const usuario = tipo === 'Bearer' && token ? await this.sesiones.verificar(token) : null;
    if (!usuario) throw new ErrorDeApi('NO_AUTENTICADO');
    pedido.usuario = usuario;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, objetivos);
    if (roles && !roles.includes(usuario.rol)) throw new ErrorDeApi('SIN_PERMISO');
    return true;
  }
}
