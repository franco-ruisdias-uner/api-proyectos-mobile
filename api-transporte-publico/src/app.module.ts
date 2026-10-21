import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModulo } from './common/files/files.module.js';
import { AuthModulo } from './common/auth/auth.module.js';
import { crearDataSource, opcionesDeBase } from './common/db/options.js';
import { NotificacionesModulo } from './common/notifications/notifications.module.js';
import { RelojModulo } from './common/clock/clock.module.js';
import { CONFIGURACION, type Configuracion } from './config/environment.js';
import { ConfiguracionModulo } from './config/environment.module.js';
import { AvisosModulo } from './modules/notices/notices.module.js';
import { DispositivosModulo } from './modules/devices/devices.module.js';
import { HorariosModulo } from './modules/schedules/schedules.module.js';
import { RedModulo } from './modules/network/network.module.js';
import { ReportesModulo } from './modules/reports/reports.module.js';
import { SaludModulo } from './modules/health/health.module.js';
import { UsuariosModulo } from './modules/users/users.module.js';
import { SemillasModulo } from './seeds/seeds.module.js';

@Module({
  imports: [
    ConfiguracionModulo,
    TypeOrmModule.forRootAsync({
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) => opcionesDeBase(config),
      dataSourceFactory: async (opciones) => crearDataSource(opciones!),
    }),
    RelojModulo,
    AuthModulo,
    ArchivosModulo,
    NotificacionesModulo,
    SaludModulo,
    RedModulo,
    HorariosModulo,
    AvisosModulo,
    ReportesModulo,
    UsuariosModulo,
    DispositivosModulo,
    SemillasModulo,
  ],
})
export class AppModule {}
