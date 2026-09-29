// Seguro por defecto (AGENTS §7.3): todo exige sesión salvo lo marcado con @Publico().
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import type { Repository } from 'typeorm';
import type { Rol } from '../../../contrato/tipos.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import { ErrorApi } from '../errores/catalogo.js';
import { esIdDe } from '../ids/ids.js';
import {
  CLAVE_PUBLICO,
  CLAVE_ROLES,
  type PedidoConUsuario,
} from './decoradores.js';
import { ServicioTokens } from './tokens.servicio.js';

@Injectable()
export class GuardAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: ServicioTokens,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const pedido = ctx.switchToHttp().getRequest<Request & PedidoConUsuario>();
    const cabecera = pedido.headers.authorization;

    if (!cabecera) {
      if (esPublico) return true;
      throw new ErrorApi('NO_AUTENTICADO');
    }
    // En un endpoint público, un token presente y válido carga el usuario; uno inválido se ignora.
    const usuario = await this.usuarioDelToken(cabecera);
    if (usuario) {
      pedido.usuario = usuario;
      return true;
    }
    if (esPublico) return true;
    throw new ErrorApi('NO_AUTENTICADO');
  }

  private async usuarioDelToken(cabecera: string): Promise<Usuario | null> {
    // Exactamente «Bearer <token>»: una cabecera con palabras de más es inválida.
    const token = /^Bearer (\S+)$/i.exec(cabecera.trim())?.[1];
    if (!token) return null;
    const contenido = this.tokens.verificar(token);
    if (!contenido || !esIdDe('usr', contenido.sub)) return null;
    return this.usuarios.findOneBy({ id: contenido.sub });
  }
}

@Injectable()
export class GuardRoles implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      CLAVE_ROLES,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!roles || roles.length === 0) return true;
    const usuario = ctx.switchToHttp().getRequest<PedidoConUsuario>().usuario;
    if (!usuario) throw new ErrorApi('NO_AUTENTICADO');
    if (!roles.includes(usuario.rol)) throw new ErrorApi('SIN_PERMISO');
    return true;
  }
}
