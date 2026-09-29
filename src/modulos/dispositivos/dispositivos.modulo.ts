import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispositivo } from './dispositivo.entidad.js';
import { ControladorDispositivos } from './dispositivos.controlador.js';
import { ServicioDispositivos } from './dispositivos.servicio.js';

@Module({
  imports: [TypeOrmModule.forFeature([Dispositivo])],
  controllers: [ControladorDispositivos],
  providers: [ServicioDispositivos],
})
export class DispositivosModulo {}
