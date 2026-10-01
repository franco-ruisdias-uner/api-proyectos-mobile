import { Module } from '@nestjs/common';
import { ControladorDispositivos } from './dispositivos.controlador.js';
import { ServicioDispositivos } from './dispositivos.servicio.js';

@Module({
  controllers: [ControladorDispositivos],
  providers: [ServicioDispositivos],
})
export class DispositivosModulo {}
