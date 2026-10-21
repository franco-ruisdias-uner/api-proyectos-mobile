import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriasControlador } from './categories.controller.js';
import { CategoriasExistentes } from '../users/existing-categories.js';
import { CategoriaEntidad } from './category.entity.js';
import { CategoriasServicio } from './categories.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CategoriaEntidad])],
  controllers: [CategoriasControlador],
  providers: [CategoriasServicio, { provide: CategoriasExistentes, useExisting: CategoriasServicio }],
  exports: [CategoriasServicio, CategoriasExistentes],
})
export class CategoriasModulo {}
