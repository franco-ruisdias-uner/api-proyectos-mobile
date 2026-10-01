import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlmacenTokensPush, type Plataforma } from '../comun/notificaciones/puertos.js';
import { Reloj } from '../comun/reloj/reloj.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';

/** Los tokens de Expo, en la tabla `dispositivos`. */
@Injectable()
export class AlmacenTokensTypeorm extends AlmacenTokensPush {
  constructor(
    @InjectRepository(DispositivoEntidad)
    private readonly dispositivos: Repository<DispositivoEntidad>,
    private readonly reloj: Reloj,
  ) {
    super();
  }

  async guardar(usuarioId: string, tokenExpo: string, plataforma: Plataforma): Promise<void> {
    await this.dispositivos.upsert(
      { tokenExpo, usuarioId, plataforma, registradoEn: this.reloj.ahora() },
      ['tokenExpo'],
    );
  }

  async borrar(tokenExpo: string): Promise<void> {
    await this.dispositivos.delete({ tokenExpo });
  }

  async tokensDe(usuarioIds: string[]): Promise<string[]> {
    if (usuarioIds.length === 0) return [];
    const filas = await this.dispositivos.find({ where: { usuarioId: In(usuarioIds) } });
    return filas.map((d) => d.tokenExpo);
  }

  async descartar(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.dispositivos.delete({ tokenExpo: In(tokens) });
  }
}
