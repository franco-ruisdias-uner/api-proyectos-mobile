import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Sesion } from '../../../contract/api.js';
import {
  hashearContrasena,
  verificarContrasena,
} from '../../common/auth/passwords.js';
import { ServicioTokens } from '../../common/auth/tokens.service.js';
import { esViolacionDeUnicidad } from '../../common/db/uniqueness.js';
import { ErrorApi } from '../../common/errors/catalog.js';
import { nuevoId } from '../../common/ids/ids.js';
import { Reloj } from '../../common/clock/clock.js';
import { Usuario } from '../users/user.entity.js';
import { aUsuario } from '../users/users.mapper.js';
import type { IngresoDto } from './dto/login.dto.js';
import type { RegistroDto } from './dto/register.dto.js';

/** Hash de una contraseña cualquiera: el ingreso tarda lo mismo exista o no el email. */
const HASH_SENUELO = hashearContrasena('contrasena-que-nadie-usa');

@Injectable()
export class ServicioAuth {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly tokens: ServicioTokens,
    private readonly reloj: Reloj,
  ) {}

  /** El registro público crea siempre un vecino (ESPECIFICACION §1). */
  async registrar(dto: RegistroDto): Promise<Sesion> {
    if (await this.usuarios.existsBy({ email: dto.email }))
      throw new ErrorApi('EMAIL_YA_REGISTRADO');
    const usuario = this.usuarios.create({
      id: nuevoId('usr'),
      nombre: dto.nombre,
      email: dto.email,
      contrasenaHash: await hashearContrasena(dto.contrasena),
      telefono: dto.telefono ?? null,
      rol: 'vecino',
      zonaId: null,
      avisosActivos: true,
      creadoEn: this.reloj.ahora(),
    });
    try {
      await this.usuarios.insert(usuario);
    } catch (error) {
      // Dos registros simultáneos pasan el chequeo de arriba: el índice único decide.
      if (esViolacionDeUnicidad(error))
        throw new ErrorApi('EMAIL_YA_REGISTRADO');
      throw error;
    }
    return this.sesion(usuario);
  }

  async ingresar(dto: IngresoDto): Promise<Sesion> {
    const usuario = await this.usuarios.findOneBy({ email: dto.email });
    const valida = await verificarContrasena(
      dto.contrasena,
      usuario?.contrasenaHash ?? (await HASH_SENUELO),
    );
    if (!usuario || !valida) throw new ErrorApi('CREDENCIALES_INVALIDAS');
    return this.sesion(usuario);
  }

  private sesion(usuario: Usuario): Sesion {
    return { token: this.tokens.firmar(usuario), usuario: aUsuario(usuario) };
  }
}
