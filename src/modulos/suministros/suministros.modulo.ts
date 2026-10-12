import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaSuministroEntidad } from '../rutas/ruta-suministro.entidad.js';
import { RutaEntidad } from '../rutas/ruta.entidad.js';
import { AccesoPorRutas } from './acceso-por-rutas.js';
import { AccesoSuministros } from './acceso-suministros.js';
import { MedidoresControlador } from './medidores.controlador.js';
import { MedidorEntidad } from './medidor.entidad.js';
import { SuministroEntidad } from './suministro.entidad.js';
import { SuministrosControlador } from './suministros.controlador.js';
import { SuministrosServicio } from './suministros.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SuministroEntidad,
      MedidorEntidad,
      RutaEntidad,
      RutaSuministroEntidad,
    ]),
  ],
  controllers: [SuministrosControlador, MedidoresControlador],
  providers: [
    SuministrosServicio,
    { provide: AccesoSuministros, useClass: AccesoPorRutas },
  ],
  exports: [TypeOrmModule, SuministrosServicio, AccesoSuministros],
})
export class SuministrosModulo {}
