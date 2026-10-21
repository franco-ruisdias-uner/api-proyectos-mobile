import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config/configuration.js';
import { Reloj, RelojFijo, RelojSistema } from './clock.js';

@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [ConfigService],
      useFactory: (config: AppConfigService): Reloj => {
        const fijo = config.get('app.fixedClock', { infer: true });
        return fijo === null ? new RelojSistema() : new RelojFijo(fijo);
      },
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
