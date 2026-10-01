import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { AlmacenTokensPorHacer } from '../../notificaciones-alumnos/almacen-tokens-por-hacer.js';
import { EnviadorPorHacer } from '../../notificaciones-alumnos/enviador-por-hacer.js';
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
  imports: [TypeOrmModule.forFeature([Usuario])],
  providers: [
    { provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensPorHacer },
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): EnviadorPush =>
        entorno.NOTIFICACIONES === 'expo'
          ? new EnviadorPorHacer(entorno.EXPO_PUSH_URL)
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
