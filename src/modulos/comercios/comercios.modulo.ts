import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comercio } from './comercio.entidad.js';
import { ComerciosControlador } from './comercios.controlador.js';
import { ComerciosServicio } from './comercios.servicio.js';
import { Rubro } from './rubro.entidad.js';

@Module({
  imports: [TypeOrmModule.forFeature([Rubro, Comercio])],
  controllers: [ComerciosControlador],
  providers: [ComerciosServicio],
  exports: [TypeOrmModule, ComerciosServicio],
})
export class ComerciosModulo {}
