import { Module } from '@nestjs/common';
import { DispositivosControlador } from './devices.controller.js';

@Module({ controllers: [DispositivosControlador] })
export class DispositivosModulo {}
