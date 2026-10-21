import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../venues/venue.entity.js';
import { BloqueoEntidad } from '../slots/block.entity.js';
import { ReservaFijaEntidad } from '../slots/standing-booking.entity.js';
import { ReservaEntidad } from '../slots/reserva.entity.js';
import { AdministracionControlador } from './admin.controller.js';
import { AdministracionServicio } from './admin.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EspacioEntidad,
      BloqueoEntidad,
      ReservaFijaEntidad,
      ReservaEntidad,
    ]),
  ],
  controllers: [AdministracionControlador],
  providers: [AdministracionServicio],
})
export class AdministracionModulo {}
