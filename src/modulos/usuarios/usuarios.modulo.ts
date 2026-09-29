import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuario.entidad.js';
import { ServicioUsuarios } from './usuarios.servicio.js';
import { ControladorYo } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [ControladorYo],
  providers: [ServicioUsuarios],
  exports: [ServicioUsuarios],
})
export class UsuariosModulo {}
