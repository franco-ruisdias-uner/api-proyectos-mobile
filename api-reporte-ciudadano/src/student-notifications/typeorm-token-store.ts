import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import type { Plataforma } from '../../contract/api.js';
import type { AlmacenTokensPush } from '../common/notifications/ports.js';
import { Dispositivo } from '../modules/devices/device.entity.js';

/** Tokens de Expo en la tabla `dispositivos`. */
@Injectable()
export class AlmacenTokensTypeOrm implements AlmacenTokensPush {
  constructor(
    @InjectRepository(Dispositivo)
    private readonly dispositivos: Repository<Dispositivo>,
  ) {}

  /** Upsert atómico por token: soporta pedidos simultáneos y el cambio de dueño. */
  async guardar(
    usuarioId: string,
    tokenExpo: string,
    plataforma: Plataforma,
  ): Promise<void> {
    const ahora = new Date();
    await this.dispositivos.upsert(
      {
        tokenExpo,
        usuarioId,
        plataforma,
        creadoEn: ahora,
        actualizadoEn: ahora,
      },
      { conflictPaths: ['tokenExpo'], skipUpdateIfNoValuesChanged: false },
    );
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.dispositivos.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.dispositivos.find({
      where: { usuarioId: In(usuarioIds) },
      select: { tokenExpo: true },
    });
    return filas.map((f) => f.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.dispositivos.delete({ tokenExpo: In(tokens) });
  }
}
