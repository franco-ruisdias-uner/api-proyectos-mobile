import { Module } from '@nestjs/common';
import { AlmacenTokensPush, EnviadorPush } from '../comun/notificaciones/puertos.js';
import { AlmacenTokensPorHacer } from './almacen-tokens-por-hacer.js';
import { EnviadorPorHacer } from './enviador-por-hacer.js';

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
