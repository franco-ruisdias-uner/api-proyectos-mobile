import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { Usuario } from './usuario.entidad.js';
import { aContrato, type ListasDeUsuario } from './usuarios.mapeador.js';

@Injectable()
export class UsuariosServicio {
  constructor(@InjectRepository(Usuario) private readonly repo: Repository<Usuario>) {}

  /** El usuario de la sesión. Si la cuenta ya no existe, la sesión no sirve. */
  async deLaSesion(id: string): Promise<Usuario> {
    const usuario = await this.repo.findOneBy({ id });
    if (!usuario) throw new ErrorApi('NO_AUTENTICADO');
    return usuario;
  }

  async contratoDe(usuario: Usuario): Promise<UsuarioContrato> {
    return aContrato(usuario, await this.listasDe(usuario.id));
  }

  async verYo(id: string): Promise<UsuarioContrato> {
    return this.contratoDe(await this.deLaSesion(id));
  }

  async actualizar(id: string, cambios: { nombre?: string }): Promise<UsuarioContrato> {
    const usuario = await this.deLaSesion(id);
    if (cambios.nombre !== undefined) usuario.nombre = cambios.nombre;
    await this.repo.save(usuario);
    return this.contratoDe(usuario);
  }

  /** Favoritos y rubros de interés: sus tablas llegan con el módulo M3 (Cuenta y favoritos). */
  private listasDe(_usuarioId: string): Promise<ListasDeUsuario> {
    return Promise.resolve({ favoritos: [], rubrosDeInteres: [] });
  }
}
