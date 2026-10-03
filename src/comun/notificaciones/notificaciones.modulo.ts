import { Global, Module } from '@nestjs/common';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { EnviadorPorHacer } from '../../notificaciones-alumnos/enviador-por-hacer.js';
import { NotificacionesAlumnosModulo } from '../../notificaciones-alumnos/notificaciones-alumnos.modulo.js';
import { Avisos } from './avisos.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { DispositivosServicio } from './dispositivos.servicio.js';
import { EnviadorRegistro } from './enviador-registro.js';
import { ENVIADOR_PUSH } from './puertos.js';

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
