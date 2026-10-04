// Guard global: exige token en todo salvo lo marcado con @Publico(), y controla
// @Roles(...). Un rol que no alcanza → SIN_PERMISO (403).
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Rol } from '../../../contrato/tipos.js';
import { ErrorApi } from '../errores/error-api.js';
import { Reloj } from '../reloj/reloj.js';
import {
  CLAVE_PUBLICO,
  CLAVE_ROLES,
  type UsuarioSesion,
} from './decoradores.js';

const ROLES: readonly Rol[] = ['jugador', 'encargado', 'administrador'];

interface CargaToken {
  sub?: unknown;
  rol?: unknown;
}

@Injectable()
export class GuardAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const objetivos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos))
      return true;

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { usuario?: UsuarioSesion }>();
    req.usuario = await this.leerSesion(req.headers.authorization);

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      CLAVE_ROLES,
      objetivos,
    );
    if (roles && !roles.includes(req.usuario.rol))
      throw new ErrorApi('SIN_PERMISO');
    return true;
  }

  private async leerSesion(
    cabecera: string | undefined,
  ): Promise<UsuarioSesion> {
    const m = /^Bearer\s+(\S+)$/i.exec(cabecera ?? '');
    if (!m) throw new ErrorApi('NO_AUTENTICADO');
    let carga: CargaToken;
    try {
      carga = await this.jwt.verifyAsync<CargaToken>(m[1], {
        algorithms: ['HS256'],
        // El vencimiento se mide con el reloj de la API (que puede estar congelado).
        clockTimestamp: Math.floor(this.reloj.ahora().getTime() / 1000),
      });
    } catch {
      throw new ErrorApi(
        'NO_AUTENTICADO',
        'Tu sesión venció o no es válida. Ingresá de nuevo.',
      );
    }
    if (typeof carga.sub !== 'string' || !ROLES.includes(carga.rol as Rol)) {
      throw new ErrorApi(
        'NO_AUTENTICADO',
        'Tu sesión venció o no es válida. Ingresá de nuevo.',
      );
    }
    return { id: carga.sub, rol: carga.rol as Rol };
  }
}
