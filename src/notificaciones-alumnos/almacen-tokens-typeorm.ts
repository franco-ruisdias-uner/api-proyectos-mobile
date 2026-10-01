import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { esViolacionDeUnicidad } from '../comun/db/unicidad.js';
import type { AlmacenTokensPush, PlataformaPush } from '../comun/notificaciones/puertos.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';

/** Los tokens de Expo en la base (tabla `dispositivos`). El token es la clave. */
@Injectable()
export class AlmacenTokensTypeorm implements AlmacenTokensPush {
  constructor(
    @InjectRepository(DispositivoEntidad) private readonly repo: Repository<DispositivoEntidad>,
    private readonly reloj: Reloj,
  ) {}

  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: PlataformaPush,
  ): Promise<{ nuevo: boolean }> {
    const existente = await this.repo.findOneBy({ tokenExpo });
    if (!existente) {
      try {
        await this.repo.insert({ tokenExpo, usuarioId, plataforma, registradoEn: this.reloj.ahora() });
        return { nuevo: true };
      } catch (error) {
        // Dos registros simultáneos del mismo token: el segundo actualiza.
        if (!esViolacionDeUnicidad(error)) throw error;
      }
    }
    await this.repo.update({ tokenExpo }, { usuarioId, plataforma });
    return { nuevo: false };
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.repo.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.repo.findBy({ usuarioId: In(usuarioIds) });
    return filas.map((f) => f.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.repo.delete({ tokenExpo: In(tokens) });
  }
}
