import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EspacioEntidad } from '../espacios/espacio.entidad.js';
import { BloqueoEntidad } from '../turnos/bloqueo.entidad.js';
import { ReservaFijaEntidad } from '../turnos/reserva-fija.entidad.js';
import { ReservaEntidad } from '../turnos/reserva.entidad.js';
import { AdministracionControlador } from './administracion.controlador.js';
import { AdministracionServicio } from './administracion.servicio.js';

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
