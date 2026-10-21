import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ErrorApi } from '../errors/error-api.js';
import { esIdConPrefijo } from '../ids/ids.js';
import { CLAVE_PUBLICO, CLAVE_ROLES, type Rol, type UsuarioAutenticado } from './decorators.js';
import { UsuariosActivos } from './active-users.js';

interface CargaToken {
  sub: string;
  rol: Rol;
}

/** Guard global: seguro por defecto. Lo público se marca con `@Publico()`. */
@Injectable()
export class GuardAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly usuarios: UsuariosActivos,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: UsuarioAutenticado }>();
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) throw new ErrorApi('NO_AUTENTICADO');

    let carga: CargaToken;
    try {
      carga = await this.jwt.verifyAsync<CargaToken>(token, { algorithms: ['HS256'] });
    } catch {
      throw new ErrorApi('NO_AUTENTICADO', 'Tu sesión venció o no es válida. Ingresá de nuevo.');
    }
    // Firmado por nosotros, pero con una forma que no es la nuestra: se trata como inválido.
    if (typeof carga.sub !== 'string' || !esIdConPrefijo(carga.sub, 'usr')) {
      throw new ErrorApi('NO_AUTENTICADO', 'Tu sesión venció o no es válida. Ingresá de nuevo.');
    }
    // El rol se lee de la base: si cambió o la cuenta ya no existe, manda la base.
    const rol = await this.usuarios.rolDe(carga.sub);
    if (!rol) throw new ErrorApi('NO_AUTENTICADO', 'Tu sesión venció o no es válida. Ingresá de nuevo.');
    req.usuario = { id: carga.sub, rol };

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(CLAVE_ROLES, destinos);
    if (roles && !roles.includes(rol)) throw new ErrorApi('SIN_PERMISO');
    return true;
  }
}
