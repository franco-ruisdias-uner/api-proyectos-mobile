import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comercio } from '../businesses/business.entity.js';
import { Rubro } from '../businesses/category.entity.js';
import { Favorito } from './favorite.entity.js';
import { RubroDeInteres } from './interest-category.entity.js';
import { Usuario } from './user.entity.js';
import { UsuariosServicio } from './users.service.js';
import { YoControlador } from './me.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, Favorito, RubroDeInteres, Rubro, Comercio])],
  controllers: [YoControlador],
  providers: [UsuariosServicio],
  exports: [UsuariosServicio, TypeOrmModule],
})
export class UsuariosModulo {}
