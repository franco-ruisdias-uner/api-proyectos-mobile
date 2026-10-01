import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { Plataforma } from '../../contrato/api.js';
import { esViolacionDeUnicidad } from '../comun/db/unicidad.js';
import type { AlmacenTokensPush } from '../comun/notificaciones/puertos.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { Dispositivo } from './dispositivo.entidad.js';

/** Los tokens de Expo viven en la tabla `dispositivos`. El token es la clave primaria. */
@Injectable()
export class AlmacenTokensTypeOrm implements AlmacenTokensPush {
  constructor(
    @InjectRepository(Dispositivo)
    private readonly dispositivos: Repository<Dispositivo>,
    private readonly reloj: Reloj,
  ) {}

  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
    reintento = false,
  ): Promise<void> {
    const existente = await this.dispositivos.findOneBy({ tokenExpo });
    if (existente) {
      if (
        existente.usuarioId !== usuarioId ||
        existente.plataforma !== plataforma
      )
        await this.dispositivos.update(
          { tokenExpo },
          { usuarioId, plataforma, creadoEn: this.reloj.ahora() },
        );
      return;
    }
    try {
      await this.dispositivos.insert({
        tokenExpo,
        usuarioId,
        plataforma,
        creadoEn: this.reloj.ahora(),
      });
    } catch (error) {
      // Dos registros simultáneos del mismo token: el segundo encuentra el del primero.
      if (esViolacionDeUnicidad(error) && !reintento)
        return this.guardar(usuarioId, tokenExpo, plataforma, true);
      throw error;
    }
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.dispositivos.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.dispositivos.find({
      where: { usuarioId: In(usuarioIds) },
      order: { tokenExpo: 'ASC' },
    });
    return filas.map((f) => f.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.dispositivos.delete({ tokenExpo: In(tokens) });
  }
}
