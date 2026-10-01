import { Module } from '@nestjs/common';
import { DispositivosControlador } from './dispositivos.controlador.js';

@Module({ controllers: [DispositivosControlador] })
export class DispositivosModulo {}
