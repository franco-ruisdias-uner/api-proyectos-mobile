import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfigService } from '../../config/configuration.js';
import { GuardiaSesion } from '../../comun/auth/guardia-sesion.js';
import { UsuariosModulo } from '../usuarios/usuarios.modulo.js';
import { AuthControlador } from './auth.controlador.js';
import { AuthServicio } from './auth.servicio.js';

@Module({
  imports: [
    UsuariosModulo,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('auth.jwtSecret', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthControlador],
  providers: [AuthServicio, { provide: APP_GUARD, useClass: GuardiaSesion }],
})
export class AuthModulo {}
