import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comercio } from '../comercios/comercio.entidad.js';
import { Rubro } from '../comercios/rubro.entidad.js';
import { Favorito } from './favorito.entidad.js';
import { RubroDeInteres } from './rubro-de-interes.entidad.js';
import { Usuario } from './usuario.entidad.js';
import { UsuariosServicio } from './usuarios.servicio.js';
import { YoControlador } from './yo.controlador.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Favorito, RubroDeInteres, Rubro, Comercio])],
  controllers: [YoControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
