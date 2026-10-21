import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Rol } from '../../../contract/types.js';
import { Reloj } from '../clock/clock.js';
import type { UsuarioSesion } from './decorators.js';

const TREINTA_DIAS_SEGUNDOS = 30 * 24 * 60 * 60;
const ROLES: readonly string[] = ['vecino', 'comercio'];

/**
 * JWT HS256 con `sub` y `rol`, que vence a los 30 días (AGENTS §7.2). La emisión y el
 * vencimiento usan el Reloj de la API, así un reloj fijo y los tokens no se contradicen.
 */
@Injectable()
export class Tokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  firmar(usuario: UsuarioSesion): string {
    const iat = Math.floor(this.reloj.ahora().getTime() / 1000);
    return this.jwt.sign(
      { sub: usuario.id, rol: usuario.rol, iat, exp: iat + TREINTA_DIAS_SEGUNDOS },
      { algorithm: 'HS256' },
    );
  }

  /** Devuelve el usuario del token, o null si es inválido o venció. */
  verificar(token: string): UsuarioSesion | null {
    try {
      const datos = this.jwt.verify<{ sub?: unknown; rol?: unknown; exp?: unknown }>(token, {
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(this.reloj.ahora().getTime() / 1000),
      });
      // jsonwebtoken acepta un token sin `exp`; acá no hay tokens eternos (AGENTS §7.2).
      if (typeof datos.exp !== 'number') return null;
      if (typeof datos.sub !== 'string' || typeof datos.rol !== 'string') return null;
      if (!ROLES.includes(datos.rol)) return null;
      return { id: datos.sub, rol: datos.rol as Rol };
    } catch {
      return null;
    }
  }
}
