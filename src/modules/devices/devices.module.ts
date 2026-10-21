import { Module } from '@nestjs/common';
import { ControladorDispositivos } from './devices.controller.js';
import { ServicioDispositivos } from './devices.service.js';

@Module({
  controllers: [ControladorDispositivos],
  providers: [ServicioDispositivos],
})
export class DispositivosModulo {}
