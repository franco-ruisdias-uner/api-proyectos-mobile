import { Global, Module } from '@nestjs/common';
import { NotificacionesAlumnosModulo } from '../../student-notifications/student-notifications.module.js';
import { AvisosServicio } from './notices.service.js';

@Global()
@Module({
  imports: [NotificacionesAlumnosModulo],
  providers: [AvisosServicio],
  exports: [AvisosServicio, NotificacionesAlumnosModulo],
})
export class NotificacionesModulo {}
