import { Module } from '@nestjs/common';
import { DispositivosControlador } from './devices.controller.js';
import { DispositivosServicio } from './devices.service.js';

@Module({
  controllers: [DispositivosControlador],
  providers: [DispositivosServicio],
})
export class DispositivosModulo {}
