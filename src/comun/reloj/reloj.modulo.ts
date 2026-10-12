import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../../config/configuracion.js';
import { Reloj, RelojFijo, RelojSistema } from './reloj.js';

@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [ConfigService],
      useFactory: (config: Configuracion): Reloj => {
        const fijo = valor(config, 'RELOJ_FIJO');
        return fijo === null ? new RelojSistema() : new RelojFijo(fijo);
      },
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
