import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccesoSinRutas, AccesoSuministros } from './acceso-suministros.js';
import { MedidoresControlador } from './medidores.controlador.js';
import { MedidorEntidad } from './medidor.entidad.js';
import { SuministroEntidad } from './suministro.entidad.js';
import { SuministrosControlador } from './suministros.controlador.js';
import { SuministrosServicio } from './suministros.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([SuministroEntidad, MedidorEntidad])],
  controllers: [SuministrosControlador, MedidoresControlador],
  providers: [
    SuministrosServicio,
    { provide: AccesoSuministros, useClass: AccesoSinRutas },
  ],
  exports: [TypeOrmModule, SuministrosServicio, AccesoSuministros],
})
export class SuministrosModulo {}
