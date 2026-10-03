import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { GuardSesion } from './comun/auth/guard-sesion.js';
import { Tokens } from './comun/auth/tokens.js';
import { opcionesTypeOrm } from './comun/db/opciones.js';
import { NotificacionesModulo } from './comun/notificaciones/notificaciones.modulo.js';
import { Reloj, RelojFijo, RelojSistema } from './comun/reloj/reloj.js';
import { ENTORNO, type Entorno } from './config/entorno.js';
import { AuthModulo } from './modulos/auth/auth.modulo.js';
import { ComerciosModulo } from './modulos/comercios/comercios.modulo.js';
import { SaludControlador } from './modulos/salud/salud.controlador.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

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
        TypeOrmModule.forRoot(opcionesTypeOrm(entorno)),
        ArchivosModulo,
        NotificacionesModulo,
        UsuariosModulo,
        AuthModulo,
        ComerciosModulo,
        SemillasModulo,
      ],
      controllers: [SaludControlador],
    };
  }
}
