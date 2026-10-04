import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthControlador } from './auth.controlador.js';
import { UsuariosControlador } from './usuarios.controlador.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad])],
  controllers: [AuthControlador, YoControlador, UsuariosControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio],
})
export class UsuariosModulo {}
