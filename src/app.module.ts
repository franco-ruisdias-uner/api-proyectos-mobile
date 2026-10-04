import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { AuthModulo } from './comun/auth/auth.modulo.js';
import { opcionesDeBase } from './comun/db/opciones.js';
import { NotificacionesModulo } from './comun/notificaciones/notificaciones.modulo.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { Configuracion, validarEntorno } from './config/configuracion.js';
import { EspaciosModulo } from './modulos/espacios/espacios.modulo.js';
import { SaludModulo } from './modulos/salud/salud.modulo.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

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
        }),
        RelojModulo,
        AuthModulo,
        ArchivosModulo,
        NotificacionesModulo,
        SaludModulo,
        UsuariosModulo,
        EspaciosModulo,
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
