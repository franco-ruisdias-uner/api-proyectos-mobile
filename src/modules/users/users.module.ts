import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../network/line.entity.js';
import { ParadaEntidad } from '../network/stop.entity.js';
import { AuthControlador } from './auth.controller.js';
import { LineaFavoritaEntidad, ParadaFavoritaEntidad } from './favorite.entity.js';
import { UsuarioEntidad } from './user.entity.js';
import { UsuariosServicio } from './users.service.js';
import { YoControlador } from './me.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UsuarioEntidad,
      LineaFavoritaEntidad,
      ParadaFavoritaEntidad,
      LineaEntidad,
      ParadaEntidad,
    ]),
  ],
  controllers: [AuthControlador, YoControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio],
})
export class UsuariosModulo {}
