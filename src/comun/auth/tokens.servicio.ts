// JWT HS256 de 30 días, sin refresh (AGENTS §7.2). iat y exp salen del Reloj, y la
// verificación usa el mismo Reloj: con RELOJ_FIJO o RelojFijo, el vencimiento es coherente.
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Rol } from '../../../contrato/tipos.js';
import { Reloj } from '../reloj/reloj.js';

export const DURACION_SESION_SEGUNDOS = 30 * 24 * 60 * 60;

export interface ContenidoToken {
  sub: string;
  rol: Rol;
  iat: number;
  exp: number;
}

@Injectable()
export class ServicioTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  private segundosAhora(): number {
    return Math.floor(this.reloj.ahora().getTime() / 1000);
  }

  firmar(usuario: { id: string; rol: Rol }): string {
    const iat = this.segundosAhora();
    const contenido: ContenidoToken = {
      sub: usuario.id,
      rol: usuario.rol,
      iat,
      exp: iat + DURACION_SESION_SEGUNDOS,
    };
    return this.jwt.sign(contenido, { algorithm: 'HS256' });
  }

  /** El contenido del token, o null si es inválido, está mal firmado o venció. */
  verificar(token: string): ContenidoToken | null {
    try {
      const contenido = this.jwt.verify<ContenidoToken>(token, {
        algorithms: ['HS256'],
        clockTimestamp: this.segundosAhora(),
      });
      return typeof contenido.sub === 'string' ? contenido : null;
    } catch {
      return null;
    }
  }
}
