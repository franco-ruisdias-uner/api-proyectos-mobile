import { Module } from '@nestjs/common';
import { SaludControlador } from './health.controller.js';

@Module({ controllers: [SaludControlador] })
export class SaludModulo {}
