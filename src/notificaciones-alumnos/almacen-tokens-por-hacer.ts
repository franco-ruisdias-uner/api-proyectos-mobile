import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { esViolacionDeUnicidad } from '../comun/errores/error-api.js';
import {
  AlmacenTokensPush,
  type Plataforma,
} from '../comun/notificaciones/puertos.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';

/** Los tokens de Expo en la tabla `dispositivos`. */
@Injectable()
export class AlmacenTokensPorHacer extends AlmacenTokensPush {
  constructor(
    @InjectRepository(DispositivoEntidad)
    private readonly repositorio: Repository<DispositivoEntidad>,
    private readonly reloj: Reloj,
  ) {
    super();
  }

  /** Idempotente por token: si lo tenía otro usuario, pasa al actual. */
  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void> {
    const fila = {
      tokenExpo,
      usuarioId,
      plataforma,
      actualizadoEn: this.reloj.ahora(),
    };
    const existente = await this.repositorio.findOneBy({ tokenExpo });
    if (existente) {
      await this.repositorio.update({ tokenExpo }, fila);
      return;
    }
    try {
      await this.repositorio.insert(fila);
    } catch (error) {
      // Dos altas simultáneas del mismo token: la segunda actualiza.
      if (!esViolacionDeUnicidad(error)) throw error;
      await this.repositorio.update({ tokenExpo }, fila);
    }
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.repositorio.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.repositorio.find({
      where: { usuarioId: In(usuarioIds) },
      order: { tokenExpo: 'ASC' },
    });
    return filas.map((f) => f.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length > 0)
      await this.repositorio.delete({ tokenExpo: In(tokens) });
  }
}
