import { Global, Module } from '@nestjs/common';
import { Configuracion } from '../../config/configuracion.js';
import { AlmacenTokensPorHacer } from '../../notificaciones-alumnos/almacen-tokens-por-hacer.js';
import { EnviadorPorHacer } from '../../notificaciones-alumnos/enviador-por-hacer.js';
import { Avisos } from './avisos.servicio.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { EnviadorRegistro } from './enviador-registro.js';
import { AlmacenTokensPush, EnviadorPush } from './puertos.js';

// TODO(alumnos): si su almacén usa una tabla, creen la entidad y súmenla acá con
// `TypeOrmModule.forFeature([...])` en `imports`.
@Global()
@Module({
  controllers: [DispositivosControlador],
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensPorHacer },
    {
      provide: EnviadorPush,
      inject: [Configuracion],
      useFactory: (config: Configuracion): EnviadorPush =>
        config.notificaciones === 'expo'
          ? new EnviadorPorHacer(config.expoPushUrl)
          : new EnviadorRegistro(),
    },
    Avisos,
  ],
  exports: [Avisos],
})
export class NotificacionesModulo {}
