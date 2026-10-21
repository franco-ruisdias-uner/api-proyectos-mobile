import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaEntidad } from '../routes/route.entity.js';
import { UsuarioEntidad } from './user.entity.js';
import { UsuariosControlador } from './users.controller.js';
import { UsuariosServicio } from './users.service.js';
import { YoControlador } from './me.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntidad, RutaEntidad])],
  controllers: [YoControlador, UsuariosControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
