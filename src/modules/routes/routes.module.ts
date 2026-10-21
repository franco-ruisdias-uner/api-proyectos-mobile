import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturaEntidad } from '../readings/reading.entity.js';
import { NovedadEntidad } from '../issues/issue.entity.js';
import { MedidorEntidad } from '../supplies/meter.entity.js';
import { SuministroEntidad } from '../supplies/supply.entity.js';
import { UsuarioEntidad } from '../users/user.entity.js';
import { RutaSuministroEntidad } from './route-supply.entity.js';
import { RutaEntidad } from './route.entity.js';
import { RutasControlador } from './routes.controller.js';
import { RutasServicio } from './routes.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RutaEntidad,
      RutaSuministroEntidad,
      SuministroEntidad,
      MedidorEntidad,
      UsuarioEntidad,
      LecturaEntidad,
      NovedadEntidad,
    ]),
  ],
  controllers: [RutasControlador],
  providers: [RutasServicio],
  exports: [RutasServicio, TypeOrmModule],
})
export class RutasModulo {}
