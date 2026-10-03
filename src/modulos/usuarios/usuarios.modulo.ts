import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuario.entidad.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [YoControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
