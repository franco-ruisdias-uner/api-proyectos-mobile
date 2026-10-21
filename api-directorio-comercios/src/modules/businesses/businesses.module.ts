import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comercio } from './business.entity.js';
import { ComerciosControlador } from './businesses.controller.js';
import { ComerciosServicio } from './businesses.service.js';
import { Rubro } from './category.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rubro, Comercio])],
  controllers: [ComerciosControlador],
  providers: [ComerciosServicio],
  exports: [TypeOrmModule, ComerciosServicio],
})
export class ComerciosModulo {}
