import {
  Inject,
  Logger,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../config/configuration.js';
import { Sembrador } from './seed.js';

@Module({ providers: [Sembrador], exports: [Sembrador] })
export class SemillasModulo implements OnApplicationBootstrap {
  constructor(
    private readonly sembrador: Sembrador,
    @Inject(ConfigService) private readonly config: AppConfigService,
  ) {}

  /** Con SEED_IF_EMPTY=true (Docker), siembra al arrancar si la base no tiene datos. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('app.seedIfEmpty', { infer: true })) return;
    if (await this.sembrador.estaVacia()) {
      new Logger('Semillas').log(
        'La base está vacía: cargo los datos de demo.',
      );
      await this.sembrador.sembrar();
    }
  }
}
