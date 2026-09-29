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
import { AlmacenArchivos } from './comun/archivos/almacen-archivos.js';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { MiddlewareOrigen } from './comun/archivos/origen.js';
import { AuthComunModulo } from './comun/auth/auth-comun.modulo.js';
import { opcionesTypeOrm } from './comun/db/opciones.js';
import { FiltroErrores } from './comun/errores/filtro-errores.js';
import { NotificacionesModulo } from './comun/notificaciones/notificaciones.modulo.js';
import { Reloj } from './comun/reloj/reloj.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { MiddlewareSimulacion } from './comun/simulacion/simulacion.middleware.js';
import { crearPipeValidacion } from './comun/validacion/pipe.js';
import { ENTORNO, EntornoModulo } from './config/entorno.modulo.js';
import type { Entorno } from './config/entorno.js';
import { AuthModulo } from './modulos/auth/auth.modulo.js';
import { DispositivosModulo } from './modulos/dispositivos/dispositivos.modulo.js';
import { ControladorSalud } from './modulos/salud/salud.controlador.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { baseVacia, sembrar } from './semillas/sembrar.js';

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
        }),
        RelojModulo,
        AuthComunModulo,
        ArchivosModulo,
        NotificacionesModulo,
        AuthModulo,
        UsuariosModulo,
        DispositivosModulo,
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
