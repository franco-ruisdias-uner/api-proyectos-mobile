import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturaEntidad } from '../readings/reading.entity.js';
import { RutaEntidad } from '../routes/route.entity.js';
import { RutaSuministroEntidad } from '../routes/route-supply.entity.js';
import { RutasModulo } from '../routes/routes.module.js';
import { NovedadEntidad } from './issue.entity.js';
import { NovedadesControlador } from './issues.controller.js';
import { NovedadesServicio } from './issues.service.js';

@Module({
  imports: [
    RutasModulo,
    TypeOrmModule.forFeature([
      NovedadEntidad,
      LecturaEntidad,
      RutaEntidad,
      RutaSuministroEntidad,
    ]),
  ],
  controllers: [NovedadesControlador],
  providers: [NovedadesServicio],
  exports: [NovedadesServicio, TypeOrmModule],
})
export class NovedadesModulo {}
