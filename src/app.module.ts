import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { moduloDeConfiguracion } from './config/configuracion.js';
import { leerEntorno } from './config/entorno.js';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { opcionesDeBase } from './comun/db/opciones.js';
import { FiltroExcepciones } from './comun/errores/filtro-excepciones.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { SaludControlador } from './comun/salud/salud.controlador.js';
import { AuthModulo } from './modulos/auth/auth.modulo.js';
import { DispositivosModulo } from './modulos/dispositivos/dispositivos.modulo.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

@Module({})
export class AppModule {
  /** La app completa, configurada con `variables` (process.env en main.ts; otras en los tests). */
  static registrar(
    variables: Record<string, string | undefined>,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        moduloDeConfiguracion(variables),
        TypeOrmModule.forRootAsync({
          useFactory: () => opcionesDeBase(leerEntorno(variables)),
        }),
        RelojModulo,
        ArchivosModulo,
        DispositivosModulo,
        UsuariosModulo,
        AuthModulo,
        SemillasModulo,
      ],
      controllers: [SaludControlador],
      providers: [{ provide: APP_FILTER, useClass: FiltroExcepciones }],
    };
  }
}
