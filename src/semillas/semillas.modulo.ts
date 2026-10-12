import {
  Inject,
  Logger,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../config/configuracion.js';
import { Sembrador } from './sembrar.js';

@Module({ providers: [Sembrador], exports: [Sembrador] })
export class SemillasModulo implements OnApplicationBootstrap {
  constructor(
    private readonly sembrador: Sembrador,
    @Inject(ConfigService) private readonly config: Configuracion,
  ) {}

  /** Con SEMBRAR_SI_VACIA=true (Docker), siembra al arrancar si la base no tiene datos. */
  async onApplicationBootstrap(): Promise<void> {
    if (!valor(this.config, 'SEMBRAR_SI_VACIA')) return;
    if (await this.sembrador.estaVacia()) {
      new Logger('Semillas').log(
        'La base está vacía: cargo los datos de demo.',
      );
      await this.sembrador.sembrar();
    }
  }
}
