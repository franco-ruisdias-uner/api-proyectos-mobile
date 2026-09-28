import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasControlador } from './categorias.controlador.js';
import { CategoriasExistentes } from '../usuarios/categorias-existentes.js';
import { CategoriaEntidad } from './categoria.entidad.js';
import { CategoriasServicio } from './categorias.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaEntidad])],
  controllers: [CategoriasControlador],
  providers: [CategoriasServicio, { provide: CategoriasExistentes, useExisting: CategoriasServicio }],
  exports: [CategoriasServicio, CategoriasExistentes],
})
export class CategoriasModulo {}
