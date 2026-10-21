import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineaEntidad } from '../network/line.entity.js';
import { LineaFavoritaEntidad } from '../users/favorite.entity.js';
import { AvisoLineaEntidad } from './notice-line.entity.js';
import { AvisoEntidad } from './notice.entity.js';
import { AvisosControlador } from './notices.controller.js';
import { AvisosServicio } from './notices.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AvisoEntidad, AvisoLineaEntidad, LineaEntidad, LineaFavoritaEntidad]),
  ],
  controllers: [AvisosControlador],
  providers: [AvisosServicio],
})
export class AvisosModulo {}
