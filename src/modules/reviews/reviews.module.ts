import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComerciosModulo } from '../businesses/businesses.module.js';
import { UsuariosModulo } from '../users/users.module.js';
import { ReporteDeResena } from './review-report.entity.js';
import { Resena } from './review.entity.js';
import { ResenasControlador } from './reviews.controller.js';
import { ResenasServicio } from './reviews.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Resena, ReporteDeResena]), ComerciosModulo, UsuariosModulo],
  controllers: [ResenasControlador],
  providers: [ResenasServicio],
  exports: [TypeOrmModule],
})
export class ResenasModulo {}
