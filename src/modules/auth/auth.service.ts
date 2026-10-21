import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Sesion } from '../../../contract/api.js';
import {
  contrasenaCoincide,
  HASH_SENUELO,
} from '../../common/auth/passwords.js';
import {
  type CargaToken,
  DURACION_REFRESCO_SEGUNDOS,
  DURACION_TOKEN_SEGUNDOS,
} from '../../common/auth/current-session.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { UsuarioEntidad } from '../users/user.entity.js';
import { UsuariosServicio } from '../users/users.service.js';
import { TokenRefrescoEntidad } from './refresh-token.entity.js';

function hashTokenRefresco(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function nuevoTokenRefresco(): string {
  return randomBytes(32).toString('base64url');
}

@Injectable()
export class AuthServicio {
  constructor(
    private readonly usuarios: UsuariosServicio,
    private readonly jwt: JwtService,
    private readonly reloj: Reloj,
    private readonly dataSource: DataSource,
    @InjectRepository(TokenRefrescoEntidad)
    private readonly tokens: Repository<TokenRefrescoEntidad>,
  ) {}

  async ingresar(legajo: string, contrasena: string): Promise<Sesion> {
    const usuario = await this.usuarios.buscarPorLegajo(legajo);
    // Se compara igual aunque el legajo no exista: mismo mensaje y tiempo parecido.
    const coincide = await contrasenaCoincide(
      contrasena,
      usuario?.hashContrasena ?? HASH_SENUELO,
    );
    if (!usuario || !coincide) throw new ErrorApi('CREDENCIALES_INVALIDAS');

    return this.sesionDe(usuario);
  }

  /**
   * Cambia el token de refresco por una sesión nueva. El que se usó deja de servir
   * (si dos pedidos lo presentan a la vez, uno solo pasa).
   */
  async refrescar(refreshToken: string): Promise<Sesion> {
    const hash = hashTokenRefresco(refreshToken);
    const previo = await this.tokens.findOneBy({ hash });
    if (!previo || previo.expiraEn.getTime() <= this.reloj.ahora().getTime()) {
      if (previo) await this.tokens.delete({ id: previo.id });
      throw new ErrorApi('NO_AUTENTICADO');
    }

    const usuario = await this.usuarioVigente(previo);
    if (!usuario) {
      await this.tokens.delete({ id: previo.id });
      throw new ErrorApi('NO_AUTENTICADO');
    }

    const nuevo = nuevoTokenRefresco();
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(TokenRefrescoEntidad);
      const borrado = await repo.delete({ id: previo.id, hash });
      if (borrado.affected !== 1) throw new ErrorApi('NO_AUTENTICADO');
      const actual = await m
        .getRepository(UsuarioEntidad)
        .findOneBy({ id: usuario.id });
      if (!actual || actual.versionSesion !== previo.versionSesion) {
        throw new ErrorApi('NO_AUTENTICADO');
      }
      await repo.insert({
        id: nuevoId('trf'),
        usuarioId: actual.id,
        hash: hashTokenRefresco(nuevo),
        versionSesion: actual.versionSesion,
        expiraEn: this.vencimientoRefresco(),
      });
    });

    return {
      token: await this.firmar(usuario),
      refreshToken: nuevo,
      usuario: await this.usuarios.contratoDe(usuario),
    };
  }

  private async sesionDe(usuario: UsuarioEntidad): Promise<Sesion> {
    const refreshToken = nuevoTokenRefresco();
    await this.tokens.insert({
      id: nuevoId('trf'),
      usuarioId: usuario.id,
      hash: hashTokenRefresco(refreshToken),
      versionSesion: usuario.versionSesion,
      expiraEn: this.vencimientoRefresco(),
    });
    return {
      token: await this.firmar(usuario),
      refreshToken,
      usuario: await this.usuarios.contratoDe(usuario),
    };
  }

  private async firmar(usuario: UsuarioEntidad): Promise<string> {
    const iat = Math.floor(this.reloj.ahora().getTime() / 1000);
    const carga: CargaToken = {
      sub: usuario.id,
      rol: usuario.rol,
      ver: usuario.versionSesion,
      iat,
      exp: iat + DURACION_TOKEN_SEGUNDOS,
    };
    return this.jwt.signAsync(carga, { algorithm: 'HS256' });
  }

  private vencimientoRefresco(): Date {
    return new Date(
      this.reloj.ahora().getTime() + DURACION_REFRESCO_SEGUNDOS * 1000,
    );
  }

  /** El usuario sigue con la misma versión de sesión con la que se emitió el refresco. */
  private async usuarioVigente(
    previo: TokenRefrescoEntidad,
  ): Promise<UsuarioEntidad | null> {
    try {
      const usuario = await this.usuarios.buscar(previo.usuarioId);
      return usuario.versionSesion === previo.versionSesion ? usuario : null;
    } catch (error) {
      if (
        error instanceof ErrorApi &&
        error.codigo === 'USUARIO_NO_ENCONTRADO'
      ) {
        return null;
      }
      throw error;
    }
  }
}
