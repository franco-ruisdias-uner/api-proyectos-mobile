import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoEntidad } from '../events/event.entity.js';
import { EventoGuardadoEntidad } from './saved-event.entity.js';
import { EventosGuardadosControlador } from './saved-events.controller.js';
import { EventosGuardadosServicio } from './saved-events.service.js';

/**
 * No importa `EventosModulo`: es al revés, `EventosModulo` lo importa para avisar los cambios de
 * estado. Por eso lee los eventos con su propio repositorio.
 */
@Module({
  imports: [TypeOrmModule.forFeature([EventoGuardadoEntidad, EventoEntidad])],
  controllers: [EventosGuardadosControlador],
  providers: [EventosGuardadosServicio],
  exports: [EventosGuardadosServicio],
})
export class EventosGuardadosModulo {}
