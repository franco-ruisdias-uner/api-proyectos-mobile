import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { Dispositivo } from '../../modulos/dispositivos/dispositivo.entidad.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import { ServicioAvisos } from './avisos.servicio.js';
import { Notificador } from './notificador.js';
import { NotificadorExpo } from './notificador-expo.js';
import { NotificadorRegistro } from './notificador-registro.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Dispositivo, Usuario])],
  providers: [
    {
      provide: Notificador,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno): Notificador =>
        entorno.NOTIFICACIONES === 'expo'
          ? new NotificadorExpo()
          : new NotificadorRegistro(),
    },
    ServicioAvisos,
  ],
  exports: [ServicioAvisos],
})
export class NotificacionesModulo implements OnApplicationShutdown {
  constructor(private readonly avisos: ServicioAvisos) {}

  async onApplicationShutdown(): Promise<void> {
    await this.avisos.esperarEnvios();
  }
}
