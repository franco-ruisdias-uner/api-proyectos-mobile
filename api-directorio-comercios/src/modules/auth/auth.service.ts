import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Sesion } from '../../../contract/api.js';
import {
  HASH_DE_RELLENO,
  hashearContrasena,
  verificarContrasena,
} from '../../common/auth/passwords.js';
import { Tokens } from '../../common/auth/tokens.js';
import { esViolacionDeUnicidad } from '../../common/db/db-errors.js';
import { ErrorApi } from '../../common/errors/error-api.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { Usuario } from '../users/user.entity.js';
import { UsuariosServicio } from '../users/users.service.js';

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class AuthServicio {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    private readonly usuarios: UsuariosServicio,
    private readonly tokens: Tokens,
    private readonly reloj: Reloj,
  ) {}

  /** El registro público crea siempre un vecino (ESPECIFICACION §1). */
  async registrar(datos: { nombre: string; email: string; contrasena: string }): Promise<Sesion> {
    const email = normalizarEmail(datos.email);
    if (await this.repo.existsBy({ email })) throw new ErrorApi('EMAIL_YA_REGISTRADO');

    const usuario = this.repo.create({
      id: nuevoId('usr'),
      nombre: datos.nombre,
      email,
      hashContrasena: await hashearContrasena(datos.contrasena),
      rol: 'vecino',
      comercioId: null,
      avisosActivos: true,
      creadoEn: this.reloj.ahora(),
    });
    try {
      await this.repo.insert(usuario);
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      if (esViolacionDeUnicidad(error)) throw new ErrorApi('EMAIL_YA_REGISTRADO');
      throw error;
    }
    return this.sesionDe(usuario);
  }

  /** Mismo error y mismo tiempo de respuesta exista o no el email. */
  async ingresar(datos: { email: string; contrasena: string }): Promise<Sesion> {
    const usuario = await this.repo.findOneBy({ email: normalizarEmail(datos.email) });
    const valida = await verificarContrasena(
      datos.contrasena,
      usuario?.hashContrasena ?? HASH_DE_RELLENO,
    );
    if (!usuario || !valida) throw new ErrorApi('CREDENCIALES_INVALIDAS');
    return this.sesionDe(usuario);
  }

  private async sesionDe(usuario: Usuario): Promise<Sesion> {
    return {
      token: this.tokens.firmar({ id: usuario.id, rol: usuario.rol }),
      usuario: await this.usuarios.contratoDe(usuario),
    };
  }
}
