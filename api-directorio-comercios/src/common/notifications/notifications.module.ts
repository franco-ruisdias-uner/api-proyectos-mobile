import { Global, Module } from '@nestjs/common';
import { ENTORNO, type Entorno } from '../../config/environment.js';
import { EnviadorPorHacer } from '../../student-notifications/todo-sender.js';
import { NotificacionesAlumnosModulo } from '../../student-notifications/student-notifications.module.js';
import { Avisos } from './notices.js';
import { DispositivosControlador } from './devices.controller.js';
import { DispositivosServicio } from './devices.service.js';
import { EnviadorRegistro } from './registry-sender.js';
import { ENVIADOR_PUSH } from './ports.js';

@Global()
@Module({
  imports: [NotificacionesAlumnosModulo],
  controllers: [DispositivosControlador],
  providers: [
    Avisos,
    DispositivosServicio,
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno) =>
        entorno.notificaciones === 'expo'
          ? new EnviadorPorHacer(entorno.expoPushUrl)
          : new EnviadorRegistro(),
    },
  ],
  exports: [Avisos],
})
export class NotificacionesModulo {}
