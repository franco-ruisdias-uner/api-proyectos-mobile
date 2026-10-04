import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservaEntidad } from '../turnos/reserva.entidad.js';
import { UsuarioEntidad } from '../usuarios/usuario.entidad.js';
import { IngresosControlador } from './ingresos.controlador.js';
import { IngresosServicio } from './ingresos.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([ReservaEntidad, UsuarioEntidad])],
  controllers: [IngresosControlador],
  providers: [IngresosServicio],
})
export class IngresosModulo {}
