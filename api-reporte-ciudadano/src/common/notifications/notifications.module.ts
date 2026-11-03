import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO } from '../../config/environment.module.js';
import type { Entorno } from '../../config/environment.js';
import { AlmacenTokensTypeOrm } from '../../student-notifications/typeorm-token-store.js';
import { EnviadorExpo } from '../../student-notifications/expo-sender.js';
import { Dispositivo } from '../../modules/devices/device.entity.js';
import { Usuario } from '../../modules/users/user.entity.js';
import { Avisos } from './notices.service.js';
import { EnviadorRegistro } from './registry-sender.js';
import {
  ALMACEN_TOKENS_PUSH,
  ENVIADOR_PUSH,
  type EnviadorPush,
} from './ports.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Dispositivo])],
  providers: [
    { provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensTypeOrm },
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): EnviadorPush =>
        entorno.NOTIFICACIONES === 'expo'
          ? new EnviadorExpo(
              entorno.EXPO_PUSH_URL,
              entorno.EXPO_ACCESS_TOKEN ?? undefined,
            )
          : new EnviadorRegistro(),
    },
    Avisos,
  ],
  exports: [Avisos, ALMACEN_TOKENS_PUSH],
})
export class NotificacionesModulo implements OnApplicationShutdown {
  constructor(private readonly avisos: Avisos) {}

  async onApplicationShutdown(): Promise<void> {
    await this.avisos.esperarEnvios();
  }
}
