import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioEntidad } from '../usuarios/usuario.entidad.js';
import { DispositivoEntidad } from './dispositivo.entidad.js';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { DispositivosServicio } from './dispositivos.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([DispositivoEntidad, UsuarioEntidad])],
  controllers: [DispositivosControlador],
  providers: [DispositivosServicio],
  exports: [DispositivosServicio],
})
export class DispositivosModulo {}
