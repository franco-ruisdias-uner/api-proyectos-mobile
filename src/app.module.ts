import { type DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardAutenticacion } from './comun/auth/guard-autenticacion.js';
import { crearDataSource, opcionesTypeOrm } from './comun/db/opciones.js';
import { FiltroExcepciones } from './comun/errores/filtro-excepciones.js';
import { errorDeValidacion } from './comun/errores/validacion.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { ENTORNO, EntornoModulo } from './config/entorno.modulo.js';
import type { Entorno } from './config/entorno.js';
import { ArchivosModulo } from './modulos/archivos/archivos.modulo.js';
import { CategoriasModulo } from './modulos/categorias/categorias.modulo.js';
import { NotificacionesModulo } from './comun/notificaciones/notificaciones.modulo.js';
import { DispositivosModulo } from './modulos/dispositivos/dispositivos.modulo.js';
import { EventosModulo } from './modulos/eventos/eventos.modulo.js';
import { EventosGuardadosModulo } from './modulos/eventos-guardados/eventos-guardados.modulo.js';
import { FavoritosModulo } from './modulos/favoritos/favoritos.modulo.js';
import { LugaresModulo } from './modulos/lugares/lugares.modulo.js';
import { SaludModulo } from './modulos/salud/salud.modulo.js';
import { VisitasModulo } from './modulos/visitas/visitas.modulo.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

@Module({})
export class AppModule {
  /** `sobrescribir` pisa variables de entorno (lo usan los tests). */
  static registrar(sobrescribir: Record<string, string> = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EntornoModulo.registrar(sobrescribir),
        RelojModulo,
        TypeOrmModule.forRootAsync({
          inject: [ENTORNO],
          useFactory: opcionesTypeOrm,
          dataSourceFactory: async (opciones) => {
            if (!opciones) throw new Error('Faltan las opciones de la base de datos.');
            return crearDataSource(opciones);
          },
        }),
        JwtModule.registerAsync({
          global: true,
          inject: [ENTORNO],
          useFactory: (entorno: Entorno) => ({
            secret: entorno.JWT_SECRETO,
            signOptions: { algorithm: 'HS256', expiresIn: '30d' },
          }),
        }),
        ArchivosModulo,
        UsuariosModulo,
        DispositivosModulo,
        NotificacionesModulo,
        CategoriasModulo,
        LugaresModulo,
        EventosModulo,
        EventosGuardadosModulo,
        FavoritosModulo,
        VisitasModulo,
        SaludModulo,
        SemillasModulo,
      ],
      providers: [
        { provide: APP_GUARD, useClass: GuardAutenticacion },
        { provide: APP_FILTER, useClass: FiltroExcepciones },
        {
          provide: APP_PIPE,
          useValue: new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            exceptionFactory: errorDeValidacion,
          }),
        },
      ],
    };
  }
}
