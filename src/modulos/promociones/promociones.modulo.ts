import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../comercios/comercios.modulo.js';
import { Promocion } from './promocion.entidad.js';
import { PromocionesControlador } from './promociones.controlador.js';
import { PromocionesServicio } from './promociones.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion]), ComerciosModulo],
  controllers: [PromocionesControlador],
  providers: [PromocionesServicio],
  exports: [TypeOrmModule, PromocionesServicio],
})
export class PromocionesModulo {}
