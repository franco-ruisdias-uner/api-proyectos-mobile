// Tokens de Expo en la tabla `dispositivos`.
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Reloj } from '../reloj/reloj.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { AlmacenTokensPush, type Plataforma } from './puertos.js';

@Injectable()
export class AlmacenTokensDb extends AlmacenTokensPush {
  constructor(
    @InjectRepository(DispositivoEntidad)
    private readonly repo: Repository<DispositivoEntidad>,
    private readonly reloj: Reloj,
  ) {
    super();
  }

  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void> {
    // upsert portable: si el token ya estaba (de éste o de otro usuario), se pisa.
    await this.repo.upsert(
      { tokenExpo, usuarioId, plataforma, actualizadoEn: this.reloj.ahora() },
      ['tokenExpo'],
    );
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.repo.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.repo.find({
      where: { usuarioId: In(usuarioIds) },
      order: { tokenExpo: 'ASC' },
    });
    return filas.map((f) => f.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.repo.delete({ tokenExpo: In(tokens) });
  }
}
