import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../network/line.entity.js';
import { ParadaEntidad } from '../network/stop.entity.js';
import { RecorridoParadaEntidad } from '../network/trip-stop.entity.js';
import { ConfirmacionDemoraEntidad } from './delay-confirmation.entity.js';
import { ReporteDemoraEntidad } from './delay-report.entity.js';
import { ReportesControlador } from './reports.controller.js';
import { ReportesServicio } from './reports.service.js';

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
