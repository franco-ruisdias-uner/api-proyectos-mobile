import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALMACEN_TOKENS_PUSH } from '../comun/notificaciones/puertos.js';
import { AlmacenTokensPorHacer } from './almacen-tokens-por-hacer.js';
import { Dispositivo } from './dispositivo.entidad.js';

/** El guardado de los tokens de Expo (AGENTS §19). El envío se arma en `NotificacionesModulo`. */
@Module({
  imports: [TypeOrmModule.forFeature([Dispositivo])],
  providers: [{ provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensPorHacer }],
  exports: [ALMACEN_TOKENS_PUSH],
})
export class NotificacionesAlumnosModulo {}
