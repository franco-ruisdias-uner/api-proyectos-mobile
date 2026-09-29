import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModulo } from '../catalogos/catalogos.modulo.js';
import { CambioDeEstado } from './cambio-de-estado.entidad.js';
import { FotoDeReporte } from './foto.entidad.js';
import {
  ControladorMisReportes,
  ControladorReportes,
} from './reportes.controlador.js';
import { ServicioReportes } from './reportes.servicio.js';
import { Reporte } from './reporte.entidad.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reporte, FotoDeReporte, CambioDeEstado]),
    CatalogosModulo,
  ],
  controllers: [ControladorReportes, ControladorMisReportes],
  providers: [ServicioReportes],
  exports: [ServicioReportes],
})
export class ReportesModulo {}
