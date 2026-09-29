import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTORNO } from '../../config/entorno.modulo.js';
import type { Entorno } from '../../config/entorno.js';
import { Usuario } from '../../modulos/usuarios/usuario.entidad.js';
import { GuardAutenticacion, GuardRoles } from './guards.js';
import { ServicioTokens } from './tokens.servicio.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario]),
    JwtModule.registerAsync({
      inject: [ENTORNO],
      useFactory: (entorno: Entorno) => ({
        secret: entorno.JWT_SECRETO,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [
    ServicioTokens,
    // El orden importa: primero se autentica, después se miran los roles.
    { provide: APP_GUARD, useClass: GuardAutenticacion },
    { provide: APP_GUARD, useClass: GuardRoles },
  ],
  exports: [ServicioTokens],
})
export class AuthComunModulo {}
