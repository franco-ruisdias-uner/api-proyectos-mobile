import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresModulo } from '../places/places.module.js';
import { FavoritoEntidad } from './favorite.entity.js';
import { FavoritosControlador } from './favorites.controller.js';
import { FavoritosServicio } from './favorites.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([FavoritoEntidad]), LugaresModulo],
  controllers: [FavoritosControlador],
  providers: [FavoritosServicio],
  exports: [FavoritosServicio],
})
export class FavoritosModulo {}
