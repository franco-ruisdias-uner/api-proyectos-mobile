import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificacionesAlumnosModulo } from '../../notificaciones-alumnos/notificaciones-alumnos.modulo.js';
import { UsuarioEntidad } from '../../modulos/usuarios/usuario.entidad.js';
import { Avisos } from './avisos.js';

/** `Avisos` para el dominio; los dos puertos los pone `NotificacionesAlumnosModulo` (AGENTS §19). */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad]), NotificacionesAlumnosModulo],
  providers: [Avisos],
  exports: [Avisos, NotificacionesAlumnosModulo],
})
export class NotificacionesModulo {}
