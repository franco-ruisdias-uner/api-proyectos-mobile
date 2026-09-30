import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CONFIGURACION, type Configuracion } from '../../config/configuracion.js';
import { Guardia } from './guardia.js';
import { Sesiones } from './sesiones.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) => ({ secret: config.jwtSecreto }),
    }),
  ],
  providers: [Sesiones, { provide: APP_GUARD, useClass: Guardia }],
  exports: [Sesiones],
})
export class AuthModulo {}
