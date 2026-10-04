import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../espacios/espacio.entidad.js';
import { FavoritoEntidad } from '../usuarios/favorito.entidad.js';
import { ReservaEntidad } from '../turnos/reserva.entidad.js';
import { TurnosModulo } from '../turnos/turnos.modulo.js';
import { ReservasControlador } from './reservas.controlador.js';
import { ReservasServicio } from './reservas.servicio.js';

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
