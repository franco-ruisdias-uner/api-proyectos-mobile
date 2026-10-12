import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedidorEntidad } from '../suministros/medidor.entidad.js';
import { SuministroEntidad } from '../suministros/suministro.entidad.js';
import { UsuarioEntidad } from '../usuarios/usuario.entidad.js';
import { RutaSuministroEntidad } from './ruta-suministro.entidad.js';
import { RutaEntidad } from './ruta.entidad.js';
import { RutasControlador } from './rutas.controlador.js';
import { RutasServicio } from './rutas.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RutaEntidad,
      RutaSuministroEntidad,
      SuministroEntidad,
      MedidorEntidad,
      UsuarioEntidad,
    ]),
  ],
  controllers: [RutasControlador],
  providers: [RutasServicio],
  exports: [RutasServicio, TypeOrmModule],
})
export class RutasModulo {}
