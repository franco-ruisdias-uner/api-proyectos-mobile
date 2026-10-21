import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesAlumnosModulo } from '../../student-notifications/student-notifications.module.js';
import { UsuarioEntidad } from '../../modules/users/user.entity.js';
import { Avisos } from './notices.js';

/** `Avisos` para el dominio; los dos puertos los pone `NotificacionesAlumnosModulo` (AGENTS §19). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad]), NotificacionesAlumnosModulo],
  providers: [Avisos],
  exports: [Avisos, NotificacionesAlumnosModulo],
})
export class NotificacionesModulo {}
