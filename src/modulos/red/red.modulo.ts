import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from './linea.entidad.js';
import { LineasControlador } from './lineas.controlador.js';
import { ParadaEntidad } from './parada.entidad.js';
import { RecorridoParadaEntidad } from './recorrido-parada.entidad.js';
import { RecorridoEntidad } from './recorrido.entidad.js';
import { RedServicio } from './red.servicio.js';
import { ParadasControlador } from './paradas.controlador.js';

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
