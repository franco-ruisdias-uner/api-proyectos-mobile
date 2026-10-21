import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModulo } from './common/files/files.module.js';
import { GuardSesion } from './common/auth/session-guard.js';
import { Tokens } from './common/auth/tokens.js';
import { DataSource } from 'typeorm';
import { crearEsquemaSiHaceFalta, opcionesTypeOrm } from './common/db/options.js';
import { NotificacionesModulo } from './common/notifications/notifications.module.js';
import { Reloj, RelojFijo, RelojSistema } from './common/clock/clock.js';
import { ENTORNO, type Entorno } from './config/environment.js';
import { AuthModulo } from './modules/auth/auth.module.js';
import { ComerciosModulo } from './modules/businesses/businesses.module.js';
import { PanelComercioModulo } from './modules/merchant-panel/merchant-panel.module.js';
import { PromocionesModulo } from './modules/promotions/promotions.module.js';
import { ResenasModulo } from './modules/reviews/reviews.module.js';
import { SaludControlador } from './modules/health/health.controller.js';
import { UsosModulo } from './modules/redemptions/redemptions.module.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { SemillasModulo } from './seeds/seeds.module.js';

/** Lo que usa toda la API: entorno, reloj, tokens. */
@Global()
@Module({})
class NucleoModulo {
  static crear(entorno: Entorno): DynamicModule {
    return {
      module: NucleoModulo,
      imports: [JwtModule.register({ secret: entorno.jwtSecreto })],
      providers: [
        { provide: ENTORNO, useValue: entorno },
        {
          provide: Reloj,
          useValue: entorno.relojFijo ? new RelojFijo(entorno.relojFijo) : new RelojSistema(),
        },
        Tokens,
        { provide: APP_GUARD, useClass: GuardSesion },
      ],
      exports: [ENTORNO, Reloj, Tokens],
    };
  }
}

@Module({})
export class AppModule {
  /** El entorno llega ya validado (validarEntorno): main.ts lo arma desde process.env y los tests, a mano. */
  static crear(entorno: Entorno): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ entorno })] }),
        NucleoModulo.crear(entorno),
        TypeOrmModule.forRootAsync({
          useFactory: () => opcionesTypeOrm(entorno),
          dataSourceFactory: async (opciones) => {
            if (!opciones) throw new Error('Faltan las opciones de la base.');
            await crearEsquemaSiHaceFalta(opciones, entorno);
            return new DataSource(opciones).initialize();
          },
        }),
        ArchivosModulo,
        NotificacionesModulo,
        UsuariosModulo,
        AuthModulo,
        ComerciosModulo,
        PromocionesModulo,
        ResenasModulo,
        PanelComercioModulo,
        UsosModulo,
        SemillasModulo,
      ],
      controllers: [SaludControlador],
    };
  }
}
