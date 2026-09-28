import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresControlador } from './lugares.controlador.js';
import { CategoriasModulo } from '../categorias/categorias.modulo.js';
import { LugarEntidad } from './lugar.entidad.js';
import { LugaresServicio } from './lugares.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([LugarEntidad]), CategoriasModulo],
  controllers: [LugaresControlador],
  providers: [LugaresServicio],
  exports: [LugaresServicio],
})
export class LugaresModulo {}
