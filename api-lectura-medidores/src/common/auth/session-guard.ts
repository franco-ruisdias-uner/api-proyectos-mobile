import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import type { Rol } from '../../../contract/types.js';
import { UsuarioEntidad } from '../../modules/users/user.entity.js';
import { ErrorApi } from '../errors/error-api.js';
import { Reloj } from '../clock/clock.js';
import { CLAVE_PUBLICO, CLAVE_ROLES } from './decorators.js';
import type { CargaToken, SesionActual } from './current-session.js';

/**
 * Guard global: exige `Authorization: Bearer <token>` salvo en lo marcado con @Publico(),
 * comprueba que la versión de sesión siga vigente y aplica @Roles().
 */
@Injectable()
export class GuardiaSesion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
    @InjectRepository(UsuarioEntidad)
    private readonly usuarios: Repository<UsuarioEntidad>,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, objetivos)) {
      return true;
    }

    const pedido = contexto
      .switchToHttp()
      .getRequest<Request & { sesion?: SesionActual }>();
    const [esquema, token] = (pedido.get('authorization') ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      throw new ErrorApi('NO_AUTENTICADO');
    }

    let carga: CargaToken;
    try {
      carga = await this.jwt.verifyAsync<CargaToken>(token, {
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(this.reloj.ahora().getTime() / 1000),
      });
    } catch {
      throw new ErrorApi('NO_AUTENTICADO');
    }
    if (typeof carga.sub !== 'string' || typeof carga.ver !== 'number') {
      throw new ErrorApi('NO_AUTENTICADO');
    }

    const usuario = await this.usuarios.findOneBy({ id: carga.sub });
    if (!usuario || usuario.versionSesion !== carga.ver) {
      throw new ErrorApi('NO_AUTENTICADO');
    }
    pedido.sesion = { usuarioId: usuario.id, rol: usuario.rol };

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      CLAVE_ROLES,
      objetivos,
    );
    if (roles && !roles.includes(usuario.rol)) {
      throw new ErrorApi('SIN_PERMISO');
    }
    return true;
  }
}
