import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArchivosModulo } from './common/files/files.module.js';
import { AuthModulo } from './common/auth/auth.module.js';
import { opcionesDeBase } from './common/db/options.js';
import { NotificacionesModulo } from './common/notifications/notifications.module.js';
import { RelojModulo } from './common/clock/clock.module.js';
import { Configuracion, validarEntorno } from './config/environment.js';
import { AdministracionModulo } from './modules/admin/admin.module.js';
import { EspaciosModulo } from './modules/venues/venues.module.js';
import { IngresosModulo } from './modules/check-ins/check-ins.module.js';
import { ReservasModulo } from './modules/bookings/bookings.module.js';
import { SaludModulo } from './modules/health/health.module.js';
import { TurnosModulo } from './modules/slots/slots.module.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { SemillasModulo } from './seeds/seeds.module.js';

export interface OpcionesAppModule {
  /** Variables de entorno explícitas (tests). Si no viene, se leen .env y el proceso. */
  entorno?: Record<string, string>;
  ignorarArchivoEnv?: boolean;
  /** Borra y recrea el esquema al conectar (tests y db:reiniciar). */
  borrarEsquema?: boolean;
  /** No sembrar al arrancar aunque SEMBRAR_SI_VACIA diga que sí (db:reiniciar siembra por su cuenta). */
  omitirSembradoInicial?: boolean;
}

@Module({})
export class AppModule {
  static registrar(opciones: OpcionesAppModule = {}): DynamicModule {
    const borrarEsquema = opciones.borrarEsquema ?? false;
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile:
            opciones.ignorarArchivoEnv ?? opciones.entorno !== undefined,
          ignoreEnvVars: opciones.entorno !== undefined,
          // Se guarda bajo una sola clave con un objeto: así no se copia nada a process.env.
          validate: (crudo) => ({
            configuracion: validarEntorno(
              opciones.entorno ?? (crudo as Record<string, string | undefined>),
            ),
          }),
        }),
        ConfiguracionModulo,
        TypeOrmModule.forRootAsync({
          inject: [Configuracion],
          useFactory: (config: Configuracion) => {
            const base = opcionesDeBase(config, { borrarEsquema });
            return borrarEsquema ? { ...base, synchronize: true } : base;
          },
          dataSourceFactory: async (opciones) => {
            if (!opciones) throw new Error('Faltan las opciones de la base.');
            const esquema =
              opciones.type === 'postgres' ? (opciones.schema ?? null) : null;
            if (esquema === null) return new DataSource(opciones).initialize();
            // Esquema propio (Supabase, Neon…): se crea (o se borra sólo ése) y recién
            // después se sincronizan las tablas. Nunca se toca otro esquema (AGENTS §18.1).
            const ds = await new DataSource({
              ...opciones,
              synchronize: false,
              dropSchema: false,
            }).initialize();
            const qr = ds.createQueryRunner();
            try {
              // `public` no se borra entero (tiene permisos de la plataforma): se vacía.
              if (opciones.dropSchema && esquema === 'public')
                await qr.clearDatabase();
              else if (opciones.dropSchema)
                await qr.dropSchema(esquema, true, true);
              await qr.createSchema(esquema, true);
            } finally {
              await qr.release();
            }
            if (opciones.synchronize) await ds.synchronize();
            return ds;
          },
        }),
        RelojModulo,
        AuthModulo,
        ArchivosModulo,
        NotificacionesModulo,
        SaludModulo,
        UsuariosModulo,
        EspaciosModulo,
        TurnosModulo,
        ReservasModulo,
        IngresosModulo,
        AdministracionModulo,
        ...(opciones.omitirSembradoInicial ? [] : [SemillasModulo]),
      ],
    };
  }
}

/** Expone la configuración validada como `Configuracion` en toda la app. */
@Global()
@Module({
  providers: [
    {
      provide: Configuracion,
      inject: [ConfigService],
      useFactory: (cs: ConfigService): Configuracion =>
        cs.getOrThrow<Configuracion>('configuracion'),
    },
  ],
  exports: [Configuracion],
})
class ConfiguracionModulo {}
