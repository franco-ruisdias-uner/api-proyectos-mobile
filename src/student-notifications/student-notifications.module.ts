import { Module } from '@nestjs/common';
import { ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH } from '../common/notifications/ports.js';
import { AlmacenTokensPorHacer } from './todo-token-store.js';
import { EnviadorPorHacer } from './todo-sender.js';

/**
 * Las dos piezas de las push que programan los alumnos (AGENTS §19). Si usan una tabla nueva,
 * agreguen acá `imports: [TypeOrmModule.forFeature([...])]`.
 */
@Module({
  providers: [
    AlmacenTokensPorHacer,
    EnviadorPorHacer,
    { provide: ALMACEN_TOKENS_PUSH, useExisting: AlmacenTokensPorHacer },
    { provide: ENVIADOR_PUSH, useExisting: EnviadorPorHacer },
  ],
  exports: [ALMACEN_TOKENS_PUSH, ENVIADOR_PUSH],
})
export class NotificacionesAlumnosModulo {}
