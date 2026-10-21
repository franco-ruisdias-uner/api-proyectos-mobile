// Emisión de tokens (AGENTS §7.2): JWT HS256, sub = id, rol, 30 días, sin refresh.
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Rol } from '../../../contract/types.js';
import { Reloj } from '../clock/clock.js';

export const DURACION_SESION_SEGUNDOS = 30 * 24 * 60 * 60;

@Injectable()
export class Sesiones {
  constructor(
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  emitir(usuario: { id: string; rol: Rol }): Promise<string> {
    const iat = Math.floor(this.reloj.ahora().getTime() / 1000);
    return this.jwt.signAsync(
      {
        sub: usuario.id,
        rol: usuario.rol,
        iat,
        exp: iat + DURACION_SESION_SEGUNDOS,
      },
      { algorithm: 'HS256' },
    );
  }
}
