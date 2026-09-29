import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControladorCatalogos } from './catalogos.controlador.js';
import { Cuadrilla } from './cuadrilla.entidad.js';
import { ServicioCuadrillas } from './cuadrillas.servicio.js';
import { TipoDeReporte } from './tipo-de-reporte.entidad.js';
import { ServicioTipos } from './tipos.servicio.js';
import { Zona } from './zona.entidad.js';
import { ServicioZonas } from './zonas.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([TipoDeReporte, Zona, Cuadrilla])],
  controllers: [ControladorCatalogos],
  providers: [ServicioTipos, ServicioZonas, ServicioCuadrillas],
  exports: [ServicioTipos, ServicioZonas, ServicioCuadrillas],
})
export class CatalogosModulo {}
