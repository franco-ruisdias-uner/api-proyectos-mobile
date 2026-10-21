import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from './line.entity.js';
import { LineasControlador } from './lines.controller.js';
import { ParadaEntidad } from './stop.entity.js';
import { RecorridoParadaEntidad } from './trip-stop.entity.js';
import { RecorridoEntidad } from './trip.entity.js';
import { RedServicio } from './network.service.js';
import { ParadasControlador } from './stops.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LineaEntidad,
      RecorridoEntidad,
      RecorridoParadaEntidad,
      ParadaEntidad,
    ]),
  ],
  controllers: [LineasControlador, ParadasControlador],
  providers: [RedServicio],
})
export class RedModulo {}
