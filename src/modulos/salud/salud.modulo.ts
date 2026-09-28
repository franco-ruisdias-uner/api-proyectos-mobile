import { Module } from '@nestjs/common';
import { SaludControlador } from './salud.controlador.js';

@Module({ controllers: [SaludControlador] })
export class SaludModulo {}
