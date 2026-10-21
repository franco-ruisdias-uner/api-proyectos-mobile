import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './user.entity.js';
import { ServicioUsuarios } from './users.service.js';
import { ControladorYo } from './me.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [ControladorYo],
  providers: [ServicioUsuarios],
  exports: [ServicioUsuarios],
})
export class UsuariosModulo {}
