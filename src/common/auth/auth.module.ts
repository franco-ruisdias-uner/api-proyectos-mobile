import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { CONFIGURACION, type Configuracion } from '../../config/environment.js';
import { Guardia } from './session-guard.js';
import { Sesiones } from './sessions.js';

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
