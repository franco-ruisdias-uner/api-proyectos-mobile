import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO, type Entorno } from '../../config/entorno.js';
import { AlmacenTokensTypeorm } from './almacen-tokens-typeorm.js';
import { Avisos } from './avisos.js';
import { Dispositivo } from './dispositivo.entidad.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { DispositivosServicio } from './dispositivos.servicio.js';
import { EnviadorExpo } from './enviador-expo.js';
import { EnviadorRegistro } from './enviador-registro.js';
import { ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH } from './puertos.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Dispositivo])],
  controllers: [DispositivosControlador],
  providers: [
    Avisos,
    DispositivosServicio,
    { provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensTypeorm },
    {
      provide: ENVIADOR_PUSH,
      inject: [ENTORNO],
      useFactory: (entorno: Entorno) =>
        entorno.notificaciones === 'expo'
          ? new EnviadorExpo(entorno.expoPushUrl)
          : new EnviadorRegistro(),
    },
  ],
  exports: [Avisos],
})
export class NotificacionesModulo {}
