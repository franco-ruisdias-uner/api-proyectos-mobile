import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import { AuthControlador } from './auth.controlador.js';
import { LineaFavoritaEntidad, ParadaFavoritaEntidad } from './favorita.entidad.js';
import { UsuarioEntidad } from './usuario.entidad.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

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
