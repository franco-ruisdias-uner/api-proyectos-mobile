import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispositivosModulo } from '../dispositivos/dispositivos.modulo.js';
import { LineaEntidad } from '../red/linea.entidad.js';
import { LineaFavoritaEntidad } from '../usuarios/favorita.entidad.js';
import { AvisoLineaEntidad } from './aviso-linea.entidad.js';
import { AvisoEntidad } from './aviso.entidad.js';
import { AvisosControlador } from './avisos.controlador.js';
import { AvisosServicio } from './avisos.servicio.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AvisoEntidad, AvisoLineaEntidad, LineaEntidad, LineaFavoritaEntidad]),
    DispositivosModulo,
  ],
  controllers: [AvisosControlador],
  providers: [AvisosServicio],
})
export class AvisosModulo {}
