import { Global, Module } from '@nestjs/common';
import { NotificacionesAlumnosModulo } from '../../notificaciones-alumnos/notificaciones-alumnos.modulo.js';
import { AvisosServicio } from './avisos.servicio.js';

@Global()
@Module({
  imports: [NotificacionesAlumnosModulo],
  providers: [AvisosServicio],
  exports: [AvisosServicio, NotificacionesAlumnosModulo],
})
export class NotificacionesModulo {}
