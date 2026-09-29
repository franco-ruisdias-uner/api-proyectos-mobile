import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '../usuarios/usuario.entidad.js';
import { ControladorAuth } from './auth.controlador.js';
import { ServicioAuth } from './auth.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [ControladorAuth],
  providers: [ServicioAuth],
})
export class AuthModulo {}
