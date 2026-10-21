import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfigService } from '../../config/configuration.js';
import { GuardiaSesion } from '../../common/auth/session-guard.js';
import { UsuariosModulo } from '../users/users.module.js';
import { AuthControlador } from './auth.controller.js';
import { AuthServicio } from './auth.service.js';
import { TokenRefrescoEntidad } from './refresh-token.entity.js';

@Module({
  imports: [
    UsuariosModulo,
    TypeOrmModule.forFeature([TokenRefrescoEntidad]),
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
