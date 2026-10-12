import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Sesion } from '../../../contrato/api.js';
import {
  contrasenaCoincide,
  HASH_SENUELO,
} from '../../comun/auth/contrasenas.js';
import {
  type CargaToken,
  DURACION_TOKEN_SEGUNDOS,
} from '../../comun/auth/sesion-actual.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { UsuariosServicio } from '../usuarios/usuarios.servicio.js';

@Injectable()
export class AuthServicio {
  constructor(
    private readonly usuarios: UsuariosServicio,
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
  ) {}

  async ingresar(legajo: string, contrasena: string): Promise<Sesion> {
    const usuario = await this.usuarios.buscarPorLegajo(legajo);
    // Se compara igual aunque el legajo no exista: mismo mensaje y tiempo parecido.
    const coincide = await contrasenaCoincide(
      contrasena,
      usuario?.hashContrasena ?? HASH_SENUELO,
    );
    if (!usuario || !coincide) throw new ErrorApi('CREDENCIALES_INVALIDAS');

    const iat = Math.floor(this.reloj.ahora().getTime() / 1000);
    const carga: CargaToken = {
      sub: usuario.id,
      rol: usuario.rol,
      ver: usuario.versionSesion,
      iat,
      exp: iat + DURACION_TOKEN_SEGUNDOS,
    };
    const token = await this.jwt.signAsync(carga, { algorithm: 'HS256' });
    return { token, usuario: await this.usuarios.contratoDe(usuario) };
  }

  async salir(usuarioId: string): Promise<void> {
    await this.usuarios.cerrarSesiones(usuarioId);
  }
}
