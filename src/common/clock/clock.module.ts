import { Global, Module } from '@nestjs/common';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { Reloj } from './clock.js';
import { RelojFijo } from './fixed-clock.js';
import { RelojSistema } from './system-clock.js';

@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): Reloj =>
        entorno.RELOJ_FIJO
          ? new RelojFijo(entorno.RELOJ_FIJO)
          : new RelojSistema(),
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
