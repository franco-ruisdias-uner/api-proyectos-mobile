import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaEntidad } from '../rutas/ruta.entidad.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { UsuariosControlador } from './usuarios.controlador.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad, RutaEntidad])],
  controllers: [YoControlador, UsuariosControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
