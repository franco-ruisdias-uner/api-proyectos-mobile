import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControladorCatalogos } from './catalogs.controller.js';
import { Cuadrilla } from './crew.entity.js';
import { ServicioCuadrillas } from './crews.service.js';
import { TipoDeReporte } from './report-type.entity.js';
import { ServicioTipos } from './tipos.service.js';
import { Zona } from './zone.entity.js';
import { ServicioZonas } from './zones.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([TipoDeReporte, Zona, Cuadrilla])],
  controllers: [ControladorCatalogos],
  providers: [ServicioTipos, ServicioZonas, ServicioCuadrillas],
  exports: [ServicioTipos, ServicioZonas, ServicioCuadrillas],
})
export class CatalogosModulo {}
