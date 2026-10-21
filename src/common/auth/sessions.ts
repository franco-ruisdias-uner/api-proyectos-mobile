import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reloj } from '../clock/clock.js';
import { ROLES, type Rol } from './roles.js';
import type { UsuarioDeSesion } from './decorators.js';

export const DURACION_DE_SESION = '30d';

/**
 * Firma y verifica los JWT (HS256, `sub` = id y `rol`, 30 días, AGENTS §7.2) con la hora
 * del Reloj de la API, así un reloj fijo también vale para los vencimientos.
 */
@Injectable()
export class Sesiones {
  constructor(
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  private segundos(): number {
    return Math.floor(this.reloj.ahora().getTime() / 1000);
  }

  firmar(usuario: UsuarioDeSesion): Promise<string> {
    return this.jwt.signAsync(
      { rol: usuario.rol, iat: this.segundos() },
      { subject: usuario.id, expiresIn: DURACION_DE_SESION, algorithm: 'HS256' },
    );
  }

  /** El usuario del token, o null si falta, está vencido, mal firmado o mal formado. */
  async verificar(token: string): Promise<UsuarioDeSesion | null> {
    try {
      const datos = await this.jwt.verifyAsync<{ sub?: unknown; rol?: unknown }>(token, {
        algorithms: ['HS256'],
        clockTimestamp: this.segundos(),
      });
      if (typeof datos.sub !== 'string' || !ROLES.includes(datos.rol as Rol)) return null;
      return { id: datos.sub, rol: datos.rol as Rol };
    } catch {
      return null;
    }
  }
}
