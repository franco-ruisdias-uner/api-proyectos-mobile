import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventosGuardadosModulo } from '../saved-events/saved-events.module.js';
import { LugaresModulo } from '../places/places.module.js';
import { EventoEntidad } from './event.entity.js';
import { EventosControlador } from './events.controller.js';
import { EventosServicio } from './events.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventoEntidad]), LugaresModulo, EventosGuardadosModulo],
  controllers: [EventosControlador],
  providers: [EventosServicio],
  exports: [EventosServicio],
})
export class EventosModulo {}
