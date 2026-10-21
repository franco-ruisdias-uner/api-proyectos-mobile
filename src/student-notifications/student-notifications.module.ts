import { Module } from '@nestjs/common';
import { AlmacenTokensPush, EnviadorPush } from '../common/notifications/ports.js';
import { AlmacenTokensPorHacer } from './todo-token-store.js';
import { EnviadorPorHacer } from './todo-sender.js';

/**
 * Dónde se enchufan las dos piezas de las notificaciones (AGENTS §19). Si necesitan una tabla,
 * agreguen su entidad con `TypeOrmModule.forFeature([…])` en `imports`.
 */
@Module({
  providers: [
    { provide: AlmacenTokensPush, useClass: AlmacenTokensPorHacer },
    { provide: EnviadorPush, useClass: EnviadorPorHacer },
  ],
  exports: [AlmacenTokensPush, EnviadorPush],
})
export class NotificacionesAlumnosModulo {}
