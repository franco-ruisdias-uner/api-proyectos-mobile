import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../venues/venue.entity.js';
import { FavoritoEntidad } from './favorite.entity.js';
import { AuthControlador } from './auth.controller.js';
import { UsuariosControlador } from './users.controller.js';
import { UsuarioEntidad } from './user.entity.js';
import { UsuariosServicio } from './users.service.js';
import { YoControlador } from './me.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsuarioEntidad, FavoritoEntidad, EspacioEntidad]),
  ],
  controllers: [AuthControlador, YoControlador, UsuariosControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio],
})
export class UsuariosModulo {}
