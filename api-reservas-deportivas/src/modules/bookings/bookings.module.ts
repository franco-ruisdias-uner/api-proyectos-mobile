import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../venues/venue.entity.js';
import { FavoritoEntidad } from '../users/favorite.entity.js';
import { ReservaEntidad } from '../slots/reserva.entity.js';
import { TurnosModulo } from '../slots/slots.module.js';
import { ReservasControlador } from './bookings.controller.js';
import { ReservasServicio } from './bookings.service.js';

@Module({
  imports: [
    TurnosModulo,
    TypeOrmModule.forFeature([ReservaEntidad, EspacioEntidad, FavoritoEntidad]),
  ],
  controllers: [ReservasControlador],
  providers: [ReservasServicio],
  exports: [ReservasServicio],
})
export class ReservasModulo {}
