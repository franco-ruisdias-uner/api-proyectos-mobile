import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeporteEntidad } from './sport.entity.js';
import { EspacioEntidad } from './venue.entity.js';
import { EspaciosControlador } from './venues.controller.js';
import { EspaciosServicio } from './venues.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeporteEntidad, EspacioEntidad])],
  controllers: [EspaciosControlador],
  providers: [EspaciosServicio],
  exports: [EspaciosServicio],
})
export class EspaciosModulo {}
