import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../red/linea.entidad.js';
import { ParadaEntidad } from '../red/parada.entidad.js';
import { RecorridoParadaEntidad } from '../red/recorrido-parada.entidad.js';
import { ConfirmacionDemoraEntidad } from './confirmacion-demora.entidad.js';
import { ReporteDemoraEntidad } from './reporte-demora.entidad.js';
import { ReportesControlador } from './reportes.controlador.js';
import { ReportesServicio } from './reportes.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReporteDemoraEntidad,
      ConfirmacionDemoraEntidad,
      LineaEntidad,
      ParadaEntidad,
      RecorridoParadaEntidad,
    ]),
  ],
  controllers: [ReportesControlador],
  providers: [ReportesServicio],
})
export class ReportesModulo {}
