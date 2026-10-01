import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { AlmacenTokensTypeOrm } from '../../notificaciones-alumnos/almacen-tokens.js';
import { Dispositivo } from '../../notificaciones-alumnos/dispositivo.entidad.js';
import { EnviadorExpo } from '../../notificaciones-alumnos/enviador-expo.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import { Avisos } from './avisos.servicio.js';
import { EnviadorRegistro } from './enviador-registro.js';
import {
  ALMACEN_TOKENS_PUSH,
  ENVIADOR_PUSH,
  type EnviadorPush,
} from './puertos.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Dispositivo, Usuario])],
  providers: [
    { provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensTypeOrm },
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): EnviadorPush =>
        entorno.NOTIFICACIONES === 'expo'
          ? new EnviadorExpo(entorno.EXPO_PUSH_URL)
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
