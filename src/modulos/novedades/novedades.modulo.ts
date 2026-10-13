import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LecturaEntidad } from '../lecturas/lectura.entidad.js';
import { RutaEntidad } from '../rutas/ruta.entidad.js';
import { RutaSuministroEntidad } from '../rutas/ruta-suministro.entidad.js';
import { RutasModulo } from '../rutas/rutas.modulo.js';
import { NovedadEntidad } from './novedad.entidad.js';
import { NovedadesControlador } from './novedades.controlador.js';
import { NovedadesServicio } from './novedades.servicio.js';

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
