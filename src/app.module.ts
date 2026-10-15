import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { DataSourceOptions } from 'typeorm';
import {
  type AppConfigService,
  configNamespaces,
} from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { crearDataSource, opcionesDeBase } from './comun/db/opciones.js';
import { FiltroExcepciones } from './comun/errores/filtro-excepciones.js';
import { RateLimitModule } from './comun/http/rate-limit.js';
import { RequestLoggerMiddleware } from './comun/http/request-logger.middleware.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { SaludControlador } from './comun/salud/salud.controlador.js';
import { AuthModulo } from './modulos/auth/auth.modulo.js';
import { DispositivosModulo } from './modulos/dispositivos/dispositivos.modulo.js';
import { LecturasModulo } from './modulos/lecturas/lecturas.modulo.js';
import { NovedadesModulo } from './modulos/novedades/novedades.modulo.js';
import { RutasModulo } from './modulos/rutas/rutas.modulo.js';
import { SuministrosModulo } from './modulos/suministros/suministros.modulo.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

@Module({
  imports: [
    // Lee el .env, lo valida con Zod (la API no arranca si algo está mal) y arma la
    // configuración de cada área. En los tests no se lee el .env: el entorno lo arma crearApp().
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.APP_ENV === 'test',
      skipProcessEnv: true,
      validate: validateEnv,
      load: configNamespaces,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService) =>
        opcionesDeBase(config.get('database', { infer: true })),
      dataSourceFactory: async (opciones) =>
        crearDataSource(opciones as DataSourceOptions),
    }),
    RateLimitModule,
    RelojModulo,
    ArchivosModulo,
    DispositivosModulo,
    UsuariosModulo,
    SuministrosModulo,
    RutasModulo,
    LecturasModulo,
    NovedadesModulo,
    AuthModulo,
    SemillasModulo,
  ],
  controllers: [SaludControlador],
  providers: [{ provide: APP_FILTER, useClass: FiltroExcepciones }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
