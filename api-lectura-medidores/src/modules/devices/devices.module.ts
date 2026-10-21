import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config/configuration.js';
import { Avisos } from '../../common/notifications/notices.js';
import { EnviadorPorHacer } from '../../student-notifications/todo-sender.js';
import { EnviadorRegistro } from '../../common/notifications/registry-sender.js';
import {
  AlmacenTokensPush,
  EnviadorPush,
} from '../../common/notifications/ports.js';
import { AlmacenTokensPorHacer } from '../../student-notifications/todo-token-store.js';
import { DispositivosControlador } from './devices.controller.js';

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
      useFactory: (config: AppConfigService): EnviadorPush => {
        const { provider, expoPushUrl } = config.get('notifications', {
          infer: true,
        });
        return provider === 'expo'
          ? new EnviadorPorHacer(expoPushUrl)
          : new EnviadorRegistro();
      },
    },
    Avisos,
  ],
  exports: [Avisos],
})
export class DispositivosModulo {}
