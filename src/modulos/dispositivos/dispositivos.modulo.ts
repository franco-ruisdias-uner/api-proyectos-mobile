import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuracion, valor } from '../../config/configuracion.js';
import { Avisos } from '../../comun/notificaciones/avisos.js';
import { EnviadorPorHacer } from '../../notificaciones-alumnos/enviador-por-hacer.js';
import { EnviadorRegistro } from '../../comun/notificaciones/enviador-registro.js';
import {
  AlmacenTokensPush,
  EnviadorPush,
} from '../../comun/notificaciones/puertos.js';
import { AlmacenTokensPorHacer } from '../../notificaciones-alumnos/almacen-tokens-por-hacer.js';
import { DispositivosControlador } from './dispositivos.controlador.js';

/** Notificaciones: los dos puertos, el servicio `Avisos` y los endpoints `/dispositivos`. */
@Global()
@Module({
  // TODO(alumnos): acá va `imports: [TypeOrmModule.forFeature([<su entidad>])]`.
  controllers: [DispositivosControlador],
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensPorHacer },
    {
      provide: EnviadorPush,
      inject: [ConfigService],
      useFactory: (config: Configuracion): EnviadorPush =>
        valor(config, 'NOTIFICACIONES') === 'expo'
          ? new EnviadorPorHacer(valor(config, 'EXPO_PUSH_URL'))
          : new EnviadorRegistro(),
    },
    Avisos,
  ],
  exports: [Avisos],
})
export class DispositivosModulo {}
