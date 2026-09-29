import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoEntidad } from '../eventos/evento.entidad.js';
import { EventoGuardadoEntidad } from './evento-guardado.entidad.js';
import { EventosGuardadosControlador } from './eventos-guardados.controlador.js';
import { EventosGuardadosServicio } from './eventos-guardados.servicio.js';

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
