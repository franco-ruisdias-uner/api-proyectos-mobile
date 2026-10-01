import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlmacenTokensPush, EnviadorPush } from '../comun/notificaciones/puertos.js';
import { CONFIGURACION, type Configuracion } from '../config/configuracion.js';
import { AlmacenTokensTypeorm } from './almacen-tokens-typeorm.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { EnviadorExpo } from './enviador-expo.js';
import { EnviadorRegistro } from './enviador-registro.js';

/** Dónde se enchufan las dos piezas de las notificaciones (AGENTS §19). */
@Module({
  imports: [TypeOrmModule.forFeature([DispositivoEntidad])],
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensTypeorm },
    {
      provide: EnviadorPush,
      inject: [CONFIGURACION],
      // NOTIFICACIONES=expo|registro elige el enviador (AGENTS §9).
      useFactory: (config: Configuracion) =>
        config.notificaciones === 'expo' ? new EnviadorExpo(config) : new EnviadorRegistro(),
    },
  ],
  exports: [AlmacenTokensPush, EnviadorPush],
})
export class NotificacionesAlumnosModulo {}
