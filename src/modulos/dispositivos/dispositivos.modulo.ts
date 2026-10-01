import { Module } from '@nestjs/common';
import { DispositivosControlador } from './dispositivos.controlador.js';
import { DispositivosServicio } from './dispositivos.servicio.js';

@Module({
  controllers: [DispositivosControlador],
  providers: [DispositivosServicio],
})
export class DispositivosModulo {}
