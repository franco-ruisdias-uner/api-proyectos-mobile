import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Sesion } from '../../../contrato/api.js';
import type { Usuario } from '../../../contrato/tipos.js';
import {
  hashContrasena,
  verificarContrasena,
} from '../../comun/auth/contrasenas.js';
import { Sesiones } from '../../comun/auth/sesiones.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { esViolacionDeUnicidad } from '../../comun/errores/unicidad.js';
import { esIdDe, nuevoId } from '../../comun/ids/ids.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { normalizarEmail } from '../../comun/texto/normalizar.js';
import type { IngresoDto } from './dto/ingreso.dto.js';
import type { RegistroDto } from './dto/registro.dto.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { aContrato } from './usuarios.mapeador.js';

/** Hash de una contraseña cualquiera, para que el ingreso tarde lo mismo exista o no el email. */
const HASH_DE_RELLENO = hashContrasena('relleno-para-igualar-tiempos');

@Injectable()
export class UsuariosServicio {
  constructor(
    @InjectRepository(UsuarioEntidad)
    private readonly repo: Repository<UsuarioEntidad>,
    private readonly sesiones: Sesiones,
    private readonly reloj: Reloj,
  ) {}

  /** El registro público siempre crea un jugador (ESPECIFICACION §1). */
  async registrar(dto: RegistroDto): Promise<Sesion> {
    const email = normalizarEmail(dto.email);
    if (await this.repo.existsBy({ email }))
      throw new ErrorApi('EMAIL_YA_REGISTRADO');
    const usuario = this.repo.create({
      id: nuevoId('usr'),
      nombre: dto.nombre,
      email,
      telefono: dto.telefono,
      rol: 'jugador',
      contrasenaHash: await hashContrasena(dto.contrasena),
      cancelacionesTardias: 0,
      ausencias: 0,
      creadoEn: this.reloj.ahora(),
    });
    try {
      await this.repo.insert(usuario);
    } catch (error) {
      // Dos registros simultáneos con el mismo email: el índice único decide.
      if (esViolacionDeUnicidad(error))
        throw new ErrorApi('EMAIL_YA_REGISTRADO');
      throw error;
    }
    return this.sesionDe(usuario);
  }

  async ingresar(dto: IngresoDto): Promise<Sesion> {
    const usuario = await this.repo.findOneBy({
      email: normalizarEmail(dto.email),
    });
    const valida = await verificarContrasena(
      dto.contrasena,
      usuario?.contrasenaHash ?? (await HASH_DE_RELLENO),
    );
    if (!usuario || !valida) throw new ErrorApi('CREDENCIALES_INVALIDAS');
    return this.sesionDe(usuario);
  }

  async yo(id: string): Promise<Usuario> {
    const usuario = await this.repo.findOneBy({ id });
    // El token es válido pero la cuenta ya no existe (por ejemplo, después de db:reiniciar).
    if (!usuario)
      throw new ErrorApi(
        'NO_AUTENTICADO',
        'Tu cuenta ya no existe. Ingresá de nuevo.',
      );
    return aContrato(usuario, await this.favoritosDe(usuario.id));
  }

  /** Para el personal (con su teléfono, para avisarle al jugador). */
  async porId(id: string): Promise<Usuario> {
    const usuario = esIdDe('usr', id)
      ? await this.repo.findOneBy({ id })
      : null;
    if (!usuario) throw new ErrorApi('USUARIO_NO_ENCONTRADO');
    return aContrato(usuario, await this.favoritosDe(usuario.id));
  }

  /** Los favoritos se guardan desde el módulo de favoritos (M6); hasta entonces no hay ninguno. */
  private favoritosDe(_usuarioId: string): Promise<string[]> {
    return Promise.resolve([]);
  }

  private async sesionDe(usuario: UsuarioEntidad): Promise<Sesion> {
    return {
      token: await this.sesiones.emitir(usuario),
      usuario: aContrato(usuario, await this.favoritosDe(usuario.id)),
    };
  }
}
