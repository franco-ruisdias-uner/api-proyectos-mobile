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
import { ArchivosModulo } from './common/files/files.module.js';
import { crearDataSource, opcionesDeBase } from './common/db/options.js';
import { FiltroExcepciones } from './common/errors/exception-filter.js';
import { RateLimitModule } from './common/http/rate-limit.js';
import { RequestLoggerMiddleware } from './common/http/request-logger.middleware.js';
import { RelojModulo } from './common/clock/clock.module.js';
import { HealthControlador } from './common/health/health.controller.js';
import { AuthModulo } from './modules/auth/auth.module.js';
import { DispositivosModulo } from './modules/devices/devices.module.js';
import { LecturasModulo } from './modules/readings/readings.module.js';
import { NovedadesModulo } from './modules/issues/issues.module.js';
import { RutasModulo } from './modules/routes/routes.module.js';
import { SuministrosModulo } from './modules/supplies/supplies.module.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { SemillasModulo } from './seeds/seeds.module.js';

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
  controllers: [HealthControlador],
  providers: [{ provide: APP_FILTER, useClass: FiltroExcepciones }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
