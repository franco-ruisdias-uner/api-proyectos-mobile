import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LugaresModulo } from '../lugares/lugares.modulo.js';
import { VisitaEntidad } from './visita.entidad.js';
import { VisitasControlador } from './visitas.controlador.js';
import { VisitasServicio } from './visitas.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([VisitaEntidad]), LugaresModulo],
  controllers: [VisitasControlador],
  providers: [VisitasServicio],
  exports: [VisitasServicio],
})
export class VisitasModulo {}
