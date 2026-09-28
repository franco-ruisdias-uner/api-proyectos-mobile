import { Inject, Logger, Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ENTORNO } from '../config/entorno.modulo.js';
import type { Entorno } from '../config/entorno.js';
import { Sembrador } from './sembrador.js';

@Module({ providers: [Sembrador], exports: [Sembrador] })
export class SemillasModulo implements OnApplicationBootstrap {
  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly sembrador: Sembrador,
  ) {}

  /** `SEMBRAR_SI_VACIA=true` (Docker): si la base no tiene datos, siembra; si tiene, no toca nada. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.entorno.SEMBRAR_SI_VACIA) return;
    if (await this.sembrador.estaVacia()) {
      new Logger('Semillas').log('La base está vacía: cargo los datos de demo.');
      await this.sembrador.sembrar();
    }
  }
}
