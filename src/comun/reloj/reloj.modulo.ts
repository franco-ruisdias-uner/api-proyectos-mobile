import { Global, Module } from '@nestjs/common';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { Reloj, RelojFijo, RelojSistema } from './reloj.js';

@Global()
@Module({
  providers: [
    {
      provide: Reloj,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): Reloj =>
        entorno.RELOJ_FIJO ? new RelojFijo(entorno.RELOJ_FIJO) : new RelojSistema(),
    },
  ],
  exports: [Reloj],
})
export class RelojModulo {}
