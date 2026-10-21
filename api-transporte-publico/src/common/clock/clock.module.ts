import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../../config/environment.js';
import { Reloj, RelojFijo, RelojSistema } from './clock.js';

/** Con RELOJ_FIJO la API arranca "congelada" en ese instante (AGENTS §6). */
@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) =>
        config.relojFijo ? new RelojFijo(config.relojFijo) : new RelojSistema(),
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
