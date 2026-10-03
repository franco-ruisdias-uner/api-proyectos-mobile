import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { Reloj } from '../comun/reloj/reloj.js';
import { Dispositivo } from './dispositivo.entidad.js';
import type { AlmacenTokensPush, Plataforma } from '../comun/notificaciones/puertos.js';

/** Tokens de Expo en la tabla `dispositivos`. */
@Injectable()
export class AlmacenTokensPorHacer implements AlmacenTokensPush {
  constructor(
    @InjectRepository(Dispositivo) private readonly repo: Repository<Dispositivo>,
    private readonly reloj: Reloj,
  ) {}

  async guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void> {
    // upsert: si otro usuario tenía el token (cambió la cuenta en el teléfono), pasa al actual.
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
