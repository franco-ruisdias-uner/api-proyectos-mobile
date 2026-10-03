import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, type Repository } from 'typeorm';
import type { Usuario as UsuarioContrato } from '../../../contrato/tipos.js';
import { esViolacionDeUnicidad } from '../../comun/db/errores-db.js';
import { ErrorApi } from '../../comun/errores/error-api.js';
import { Reloj } from '../../comun/reloj/reloj.js';
import { Comercio } from '../comercios/comercio.entidad.js';
import { Rubro } from '../comercios/rubro.entidad.js';
import { Favorito } from './favorito.entidad.js';
import { RubroDeInteres } from './rubro-de-interes.entidad.js';
import { rubrosInexistentes, sinRepetidos } from './reglas/rubros.js';
import { Usuario } from './usuario.entidad.js';
import { aContrato, type ListasDeUsuario } from './usuarios.mapeador.js';

@Injectable()
export class UsuariosServicio {
  constructor(
    @InjectRepository(Usuario) private readonly repo: Repository<Usuario>,
    @InjectRepository(Favorito) private readonly favoritos: Repository<Favorito>,
    @InjectRepository(RubroDeInteres) private readonly intereses: Repository<RubroDeInteres>,
    @InjectRepository(Comercio) private readonly comercios: Repository<Comercio>,
    private readonly dataSource: DataSource,
    private readonly reloj: Reloj,
  ) {}

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

  async actualizar(
    id: string,
    cambios: { nombre?: string; rubrosDeInteres?: string[]; avisosActivos?: boolean },
  ): Promise<UsuarioContrato> {
    const usuario = await this.deLaSesion(id);
    const rubros = cambios.rubrosDeInteres && sinRepetidos(cambios.rubrosDeInteres);
    if (rubros) {
      const existentes = rubros.length
        ? await this.dataSource.getRepository(Rubro).findBy({ id: In(rubros) })
        : [];
      if (
        rubrosInexistentes(
          rubros,
          existentes.map((r) => r.id),
        ).length > 0
      ) {
        throw new ErrorApi('RUBRO_NO_ENCONTRADO');
      }
    }
    if (cambios.nombre !== undefined) usuario.nombre = cambios.nombre;
    if (cambios.avisosActivos !== undefined) usuario.avisosActivos = cambios.avisosActivos;
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(Usuario).save(usuario);
      if (rubros) {
        await m.getRepository(RubroDeInteres).delete({ usuarioId: id });
        if (rubros.length) {
          await m
            .getRepository(RubroDeInteres)
            .insert(rubros.map((rubroId, posicion) => ({ usuarioId: id, rubroId, posicion })));
        }
      }
    });
    return this.contratoDe(usuario);
  }

  /** Idempotente: si ya era favorito no hace nada (ni siquiera con dos pedidos simultáneos). */
  async agregarFavorito(id: string, comercioId: string): Promise<UsuarioContrato> {
    if (!/^com-[A-Za-z0-9_-]{1,36}$/.test(comercioId)) {
      throw new ErrorApi('VALIDACION_FALLIDA', 'El comercio elegido no es válido.');
    }
    const usuario = await this.deLaSesion(id);
    if (!(await this.comercios.existsBy({ id: comercioId }))) {
      throw new ErrorApi('COMERCIO_NO_ENCONTRADO');
    }
    if (!(await this.favoritos.existsBy({ usuarioId: id, comercioId }))) {
      try {
        await this.favoritos.insert({ usuarioId: id, comercioId, creadoEn: this.reloj.ahora() });
      } catch (error) {
        if (!esViolacionDeUnicidad(error)) throw error;
      }
    }
    return this.contratoDe(usuario);
  }

  async quitarFavorito(id: string, comercioId: string): Promise<void> {
    await this.favoritos.delete({ usuarioId: id, comercioId });
  }

  private async listasDe(usuarioId: string): Promise<ListasDeUsuario> {
    const favoritos = await this.favoritos.find({
      where: { usuarioId },
      order: { creadoEn: 'ASC', comercioId: 'ASC' },
    });
    const intereses = await this.intereses.find({
      where: { usuarioId },
      order: { posicion: 'ASC' },
    });
    return {
      favoritos: favoritos.map((f) => f.comercioId),
      rubrosDeInteres: intereses.map((r) => r.rubroId),
    };
  }
}
