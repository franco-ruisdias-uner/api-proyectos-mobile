import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../espacios/espacio.entidad.js';
import { BloqueoEntidad } from './bloqueo.entidad.js';
import { ReservaFijaEntidad } from './reserva-fija.entidad.js';
import { ReservaEntidad } from './reserva.entidad.js';
import { TurnosControlador } from './turnos.controlador.js';
import { TurnosServicio } from './turnos.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EspacioEntidad,
      ReservaEntidad,
      ReservaFijaEntidad,
      BloqueoEntidad,
    ]),
  ],
  controllers: [TurnosControlador],
  providers: [TurnosServicio],
  exports: [TurnosServicio],
})
export class TurnosModulo {}
