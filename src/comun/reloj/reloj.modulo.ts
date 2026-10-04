import { Global, Module } from '@nestjs/common';
import { Configuracion } from '../../config/configuracion.js';
import { Reloj, RelojFijo, RelojSistema } from './reloj.js';

@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [Configuracion],
      useFactory: (config: Configuracion): Reloj =>
        config.relojFijo ? new RelojFijo(config.relojFijo) : new RelojSistema(),
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
