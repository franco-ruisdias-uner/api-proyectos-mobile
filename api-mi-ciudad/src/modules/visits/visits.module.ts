import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresModulo } from '../places/places.module.js';
import { VisitaEntidad } from './visit.entity.js';
import { VisitasControlador } from './visits.controller.js';
import { VisitasServicio } from './visits.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([VisitaEntidad]), LugaresModulo],
  controllers: [VisitasControlador],
  providers: [VisitasServicio],
  exports: [VisitasServicio],
})
export class VisitasModulo {}
