import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioEntidad } from './usuario.entidad.js';
import { UsuariosControlador } from './usuarios.controlador.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad])],
  controllers: [YoControlador, UsuariosControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
