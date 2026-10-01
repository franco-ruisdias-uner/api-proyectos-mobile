import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH, type EnviadorPush } from '../comun/notificaciones/puertos.js';
import { ENTORNO } from '../config/entorno.modulo.js';
import type { Entorno } from '../config/entorno.js';
import { AlmacenTokensTypeorm } from './almacen-tokens-typeorm.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { EnviadorExpo } from './enviador-expo.js';
import { EnviadorRegistro } from './enviador-registro.js';

/** Las dos piezas de las push que programan los alumnos (AGENTS §19). */
@Module({
  imports: [TypeOrmModule.forFeature([DispositivoEntidad])],
  providers: [
    AlmacenTokensTypeorm,
    EnviadorExpo,
    EnviadorRegistro,
    { provide: ALMACEN_TOKENS_PUSH, useExisting: AlmacenTokensTypeorm },
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO, EnviadorExpo, EnviadorRegistro],
      useFactory: (e: Entorno, expo: EnviadorExpo, registro: EnviadorRegistro): EnviadorPush =>
        e.NOTIFICACIONES === 'expo' ? expo : registro,
    },
  ],
  exports: [ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH],
})
export class NotificacionesAlumnosModulo {}
