import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivosModulo } from './comun/archivos/archivos.modulo.js';
import { AuthModulo } from './comun/auth/auth.modulo.js';
import { opcionesDeBase } from './comun/db/opciones.js';
import { NotificacionesModulo } from './comun/notificaciones/notificaciones.modulo.js';
import { RelojModulo } from './comun/reloj/reloj.modulo.js';
import { CONFIGURACION, type Configuracion } from './config/configuracion.js';
import { ConfiguracionModulo } from './config/configuracion.modulo.js';
import { AvisosModulo } from './modulos/avisos/avisos.modulo.js';
import { DispositivosModulo } from './modulos/dispositivos/dispositivos.modulo.js';
import { HorariosModulo } from './modulos/horarios/horarios.modulo.js';
import { RedModulo } from './modulos/red/red.modulo.js';
import { SaludModulo } from './modulos/salud/salud.modulo.js';
import { UsuariosModulo } from './modulos/usuarios/usuarios.modulo.js';
import { SemillasModulo } from './semillas/semillas.modulo.js';

@Module({
  imports: [
    ConfiguracionModulo,
    TypeOrmModule.forRootAsync({
      inject: [CONFIGURACION],
      useFactory: (config: Configuracion) => opcionesDeBase(config),
    }),
    RelojModulo,
    AuthModulo,
    ArchivosModulo,
    NotificacionesModulo,
    SaludModulo,
    RedModulo,
    HorariosModulo,
    AvisosModulo,
    UsuariosModulo,
    DispositivosModulo,
    SemillasModulo,
  ],
})
export class AppModule {}
