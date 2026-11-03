import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModulo } from '../catalogs/catalogs.module.js';
import { TipoDeReporte } from '../catalogs/report-type.entity.js';
import { Usuario } from '../users/user.entity.js';
import { Adhesion } from './follow.entity.js';
import { ServicioAdhesiones } from './follows.service.js';
import { AvisosDeReportes } from './report-notices.service.js';
import { ServicioBandeja } from './inbox.service.js';
import { CambioDeEstado } from './status-change.entity.js';
import { FotoDeReporte } from './photo.entity.js';
import {
  ControladorBandeja,
  ControladorMisReportes,
  ControladorReportes,
} from './reports.controller.js';
import { ServicioReportes } from './reports.service.js';
import { Reporte } from './report.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reporte,
      FotoDeReporte,
      CambioDeEstado,
      Adhesion,
      TipoDeReporte,
      Usuario,
    ]),
    CatalogosModulo,
  ],
  controllers: [
    ControladorReportes,
    ControladorMisReportes,
    ControladorBandeja,
  ],
  providers: [
    ServicioReportes,
    ServicioAdhesiones,
    ServicioBandeja,
    AvisosDeReportes,
  ],
  exports: [ServicioReportes, ServicioAdhesiones],
})
export class ReportesModulo {}
