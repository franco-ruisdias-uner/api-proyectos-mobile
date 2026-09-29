import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresModulo } from '../lugares/lugares.modulo.js';
import { EventoEntidad } from './evento.entidad.js';
import { EventosControlador } from './eventos.controlador.js';
import { EventosServicio } from './eventos.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventoEntidad]), LugaresModulo],
  controllers: [EventosControlador],
  providers: [EventosServicio],
  exports: [EventosServicio],
})
export class EventosModulo {}
