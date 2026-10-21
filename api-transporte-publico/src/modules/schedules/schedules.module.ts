import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../network/line.entity.js';
import { ParadaEntidad } from '../network/stop.entity.js';
import { FeriadoEntidad } from './holiday.entity.js';
import { FeriadosControlador } from './holidays.controller.js';
import { HorarioEntidad } from './schedule.entity.js';
import { HorariosControlador } from './schedules.controller.js';
import { HorariosServicio } from './schedules.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([HorarioEntidad, FeriadoEntidad, ParadaEntidad, LineaEntidad]),
  ],
  controllers: [HorariosControlador, FeriadosControlador],
  providers: [HorariosServicio],
})
export class HorariosModulo {}
