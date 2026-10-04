import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Configuracion } from '../../config/configuracion.js';
import { GuardAutenticacion } from './guard-autenticacion.js';
import { Sesiones } from './sesiones.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [Configuracion],
      useFactory: (config: Configuracion) => ({
        secret: config.jwtSecreto,
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  providers: [Sesiones, { provide: APP_GUARD, useClass: GuardAutenticacion }],
  exports: [Sesiones],
})
export class AuthModulo {}
