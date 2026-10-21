import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../businesses/businesses.module.js';
import { Promocion } from './promotion.entity.js';
import { PromocionesControlador } from './promotions.controller.js';
import { PromocionesServicio } from './promotions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion]), ComerciosModulo],
  controllers: [PromocionesControlador],
  providers: [PromocionesServicio],
  exports: [TypeOrmModule, PromocionesServicio],
})
export class PromocionesModulo {}
