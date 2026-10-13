import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RutaSuministroEntidad } from '../rutas/ruta-suministro.entidad.js';
import { RutasModulo } from '../rutas/rutas.modulo.js';
import { MedidorEntidad } from '../suministros/medidor.entidad.js';
import { SuministroEntidad } from '../suministros/suministro.entidad.js';
import { LecturaEntidad } from './lectura.entidad.js';
import { LecturasControlador } from './lecturas.controlador.js';
import { LecturasServicio } from './lecturas.servicio.js';

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
