import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificador } from '../../comun/notificaciones/notificador.js';
import { NotificadorExpo } from '../../comun/notificaciones/notificador-expo.js';
import { NotificadorRegistro } from '../../comun/notificaciones/notificador-registro.js';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { AvisosServicio } from './avisos.servicio.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { DispositivosServicio } from './dispositivos.servicio.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DispositivoEntidad])],
  controllers: [DispositivosControlador],
  providers: [
    DispositivosServicio,
    AvisosServicio,
    {
      provide: Notificador,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): Notificador =>
        entorno.NOTIFICACIONES === 'expo' ? new NotificadorExpo() : new NotificadorRegistro(),
    },
  ],
  exports: [AvisosServicio],
})
export class DispositivosModulo {}
