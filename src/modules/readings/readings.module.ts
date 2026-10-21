import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaSuministroEntidad } from '../routes/route-supply.entity.js';
import { RutasModulo } from '../routes/routes.module.js';
import { MedidorEntidad } from '../supplies/meter.entity.js';
import { SuministroEntidad } from '../supplies/supply.entity.js';
import { LecturaEntidad } from './reading.entity.js';
import { LecturasControlador } from './readings.controller.js';
import { LecturasServicio } from './readings.service.js';

@Module({
  imports: [
    RutasModulo,
    TypeOrmModule.forFeature([
      LecturaEntidad,
      RutaSuministroEntidad,
      SuministroEntidad,
      MedidorEntidad,
    ]),
  ],
  controllers: [LecturasControlador],
  providers: [LecturasServicio],
  exports: [LecturasServicio, TypeOrmModule],
})
export class LecturasModulo {}
