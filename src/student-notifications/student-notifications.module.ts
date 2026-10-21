import { Module } from '@nestjs/common';
import { ALMACEN_TOKENS_PUSH } from '../common/notifications/ports.js';
import { AlmacenTokensPorHacer } from './todo-token-store.js';

/**
 * El guardado de los tokens de Expo (AGENTS §19). El envío se arma en `NotificacionesModulo`.
 *
 * TODO(alumnos): si guardan los tokens en una tabla propia, creen la entidad en esta carpeta y
 * registrenla acá con `imports: [TypeOrmModule.forFeature([MiEntidad])]`.
 */
@Module({
  imports: [],
  providers: [{ provide: ALMACEN_TOKENS_PUSH, useClass: AlmacenTokensPorHacer }],
  exports: [ALMACEN_TOKENS_PUSH],
})
export class NotificacionesAlumnosModulo {}
