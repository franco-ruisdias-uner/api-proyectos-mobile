import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaSuministroEntidad } from '../routes/route-supply.entity.js';
import { RutaEntidad } from '../routes/route.entity.js';
import { AccesoPorRutas } from './route-access.js';
import { AccesoSuministros } from './supply-access.js';
import { MedidoresControlador } from './meters.controller.js';
import { MedidorEntidad } from './meter.entity.js';
import { SuministroEntidad } from './supply.entity.js';
import { SuministrosControlador } from './supplies.controller.js';
import { SuministrosServicio } from './supplies.service.js';

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
