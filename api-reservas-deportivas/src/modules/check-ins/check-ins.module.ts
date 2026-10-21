import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservaEntidad } from '../slots/reserva.entity.js';
import { UsuarioEntidad } from '../users/user.entity.js';
import { IngresosControlador } from './check-ins.controller.js';
import { IngresosServicio } from './check-ins.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReservaEntidad, UsuarioEntidad])],
  controllers: [IngresosControlador],
  providers: [IngresosServicio],
})
export class IngresosModulo {}
