import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeporteEntidad } from './deporte.entidad.js';
import { EspacioEntidad } from './espacio.entidad.js';
import { EspaciosControlador } from './espacios.controlador.js';
import { EspaciosServicio } from './espacios.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([DeporteEntidad, EspacioEntidad])],
  controllers: [EspaciosControlador],
  providers: [EspaciosServicio],
  exports: [EspaciosServicio],
})
export class EspaciosModulo {}
