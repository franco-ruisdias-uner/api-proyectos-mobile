import { type DynamicModule, Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardAutenticacion } from './common/auth/session-guard.js';
import { crearDataSource, opcionesTypeOrm } from './common/db/options.js';
import { FiltroExcepciones } from './common/errors/exception-filter.js';
import { errorDeValidacion } from './common/errors/validation.js';
import { RelojModulo } from './common/clock/clock.module.js';
import { ENTORNO, EntornoModulo } from './config/environment.module.js';
import type { Entorno } from './config/environment.js';
import { ArchivosModulo } from './modules/files/files.module.js';
import { CategoriasModulo } from './modules/categories/categories.module.js';
import { NotificacionesModulo } from './common/notifications/notifications.module.js';
import { DispositivosModulo } from './modules/devices/devices.module.js';
import { EventosModulo } from './modules/events/events.module.js';
import { EventosGuardadosModulo } from './modules/saved-events/saved-events.module.js';
import { FavoritosModulo } from './modules/favorites/favorites.module.js';
import { LugaresModulo } from './modules/places/places.module.js';
import { SaludModulo } from './modules/health/health.module.js';
import { VisitasModulo } from './modules/visits/visits.module.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { SemillasModulo } from './seeds/seeds.module.js';

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
