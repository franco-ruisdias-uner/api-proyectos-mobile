import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracion } from '../../config/configuracion.js';
import { AlmacenTokensDb } from './almacen-tokens-db.js';
import { Avisos } from './avisos.servicio.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { EnviadorExpo } from './enviador-expo.js';
import { EnviadorRegistro } from './enviador-registro.js';
import { AlmacenTokensPush, EnviadorPush } from './puertos.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DispositivoEntidad])],
  controllers: [DispositivosControlador],
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensDb },
    {
      provide: EnviadorPush,
      inject: [Configuracion],
      useFactory: (config: Configuracion): EnviadorPush =>
        config.notificaciones === 'expo'
          ? new EnviadorExpo(config.expoPushUrl)
          : new EnviadorRegistro(),
    },
    Avisos,
  ],
  exports: [Avisos],
})
export class NotificacionesModulo {}
