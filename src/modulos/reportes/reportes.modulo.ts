import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogosModulo } from '../catalogos/catalogos.modulo.js';
import { Adhesion } from './adhesion.entidad.js';
import { ServicioAdhesiones } from './adhesiones.servicio.js';
import { AvisosDeReportes } from './avisos-de-reportes.servicio.js';
import { ServicioBandeja } from './bandeja.servicio.js';
import { CambioDeEstado } from './cambio-de-estado.entidad.js';
import { FotoDeReporte } from './foto.entidad.js';
import {
  ControladorBandeja,
  ControladorMisReportes,
  ControladorReportes,
} from './reportes.controlador.js';
import { ServicioReportes } from './reportes.servicio.js';
import { Reporte } from './reporte.entidad.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reporte,
      FotoDeReporte,
      CambioDeEstado,
      Adhesion,
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
