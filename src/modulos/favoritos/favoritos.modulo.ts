import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresModulo } from '../lugares/lugares.modulo.js';
import { FavoritoEntidad } from './favorito.entidad.js';
import { FavoritosControlador } from './favoritos.controlador.js';
import { FavoritosServicio } from './favoritos.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([FavoritoEntidad]), LugaresModulo],
  controllers: [FavoritosControlador],
  providers: [FavoritosServicio],
  exports: [FavoritosServicio],
})
export class FavoritosModulo {}
