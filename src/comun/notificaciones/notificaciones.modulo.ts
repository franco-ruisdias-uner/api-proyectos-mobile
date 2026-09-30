import { Global, Module } from '@nestjs/common';
import { CONFIGURACION, type Configuracion } from '../../config/configuracion.js';
import { Notificador } from './notificador.js';
import { NotificadorExpo } from './notificador-expo.js';
import { NotificadorRegistro } from './notificador-registro.js';

/** NOTIFICACIONES=expo|registro elige la implementación del puerto (AGENTS §9). */
@Global()
@Module({
  providers: [
    {
      provide: Notificador,
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) =>
        config.notificaciones === 'expo' ? new NotificadorExpo() : new NotificadorRegistro(),
    },
  ],
  exports: [Notificador],
})
export class NotificacionesModulo {}
