import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import { FeriadoEntidad } from './feriado.entidad.js';
import { FeriadosControlador } from './feriados.controlador.js';
import { HorarioEntidad } from './horario.entidad.js';
import { HorariosControlador } from './horarios.controlador.js';
import { HorariosServicio } from './horarios.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([HorarioEntidad, FeriadoEntidad, ParadaEntidad, LineaEntidad]),
  ],
  controllers: [HorariosControlador, FeriadosControlador],
  providers: [HorariosServicio],
})
export class HorariosModulo {}
