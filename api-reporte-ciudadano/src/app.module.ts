import {
  Inject,
  Logger,
  Module,
  type DynamicModule,
  type MiddlewareConsumer,
  type NestModule,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AlmacenArchivos } from './common/files/file-storage.js';
import { ArchivosModulo } from './common/files/files.module.js';
import { MiddlewareOrigen } from './common/files/origin.js';
import { AuthComunModulo } from './common/auth/auth-common.module.js';
import { crearDataSource, opcionesTypeOrm } from './common/db/options.js';
import { FiltroErrores } from './common/errors/exception-filter.js';
import { NotificacionesModulo } from './common/notifications/notifications.module.js';
import { Reloj } from './common/clock/clock.js';
import { RelojModulo } from './common/clock/clock.module.js';
import { MiddlewareSimulacion } from './common/simulation/simulation-middleware.js';
import { crearPipeValidacion } from './common/validation/pipe.js';
import { ENTORNO, EntornoModulo } from './config/environment.module.js';
import type { Entorno } from './config/environment.js';
import { AuthModulo } from './modules/auth/auth.module.js';
import { CatalogosModulo } from './modules/catalogs/catalogs.module.js';
import { DispositivosModulo } from './modules/devices/devices.module.js';
import { ReportesModulo } from './modules/reports/reports.module.js';
import { ControladorSalud } from './modules/health/health.controller.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { baseVacia, sembrar } from './seeds/seed.js';

@Module({})
export class AppModule implements NestModule, OnApplicationBootstrap {
  private readonly logger = new Logger('Arranque');

  constructor(
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly dataSource: DataSource,
    private readonly almacen: AlmacenArchivos,
    private readonly reloj: Reloj,
  ) {}

  /** `sobrescribir` pisa variables de entorno (lo usan los tests). */
  static registrar(sobrescribir: Record<string, string> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EntornoModulo.registrar(sobrescribir),
        TypeOrmModule.forRootAsync({
          inject: [ENTORNO],
          useFactory: opcionesTypeOrm,
          dataSourceFactory: async (opciones) => crearDataSource(opciones!),
        }),
        RelojModulo,
        AuthComunModulo,
        ArchivosModulo,
        NotificacionesModulo,
        AuthModulo,
        UsuariosModulo,
        DispositivosModulo,
        CatalogosModulo,
        ReportesModulo,
      ],
      controllers: [ControladorSalud],
      providers: [
        { provide: APP_FILTER, useClass: FiltroErrores },
        { provide: APP_PIPE, useFactory: crearPipeValidacion },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // La simulación va primero: un error-500 simulado sale aunque falte el token.
    consumer.apply(MiddlewareSimulacion, MiddlewareOrigen).forRoutes('*');
  }

  /** SEMBRAR_SI_VACIA: la primera vez (Docker), crea los datos de demo; si ya hay, no toca nada. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.entorno.SEMBRAR_SI_VACIA) return;
    if (!(await baseVacia(this.dataSource))) return;
    this.logger.log('La base está vacía: cargando los datos de demo…');
    await sembrar(this.dataSource, this.almacen, this.reloj);
    this.logger.log('Datos de demo cargados.');
  }
}
