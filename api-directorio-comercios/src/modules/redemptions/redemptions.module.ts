import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../businesses/businesses.module.js';
import { PromocionesModulo } from '../promotions/promotions.module.js';
import { UsuariosModulo } from '../users/users.module.js';
import { UsoDePromocion } from './promotion-redemption.entity.js';
import { UsosControlador } from './redemptions.controller.js';
import { UsosServicio } from './redemptions.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsoDePromocion]),
    ComerciosModulo,
    PromocionesModulo,
    UsuariosModulo,
  ],
  controllers: [UsosControlador],
  providers: [UsosServicio],
  exports: [TypeOrmModule],
})
export class UsosModulo {}
