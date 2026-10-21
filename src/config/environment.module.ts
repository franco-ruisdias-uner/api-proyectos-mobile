import { type DynamicModule, Global, Module } from '@nestjs/common';
import { validarEntorno } from './environment.js';

export const ENTORNO = Symbol('ENTORNO');

/**
 * Configuración validada al arrancar. `.env` se carga antes (ver `cargar-env.ts`), porque las
 * entidades eligen el tipo de columna de los instantes según `DB_MOTOR` al importarse.
 */
@Global()
@Module({})
export class EntornoModulo {
  static registrar(sobrescribir: Record<string, string> = {}): DynamicModule {
    return {
      module: EntornoModulo,
      providers: [{ provide: ENTORNO, useValue: validarEntorno({ ...process.env, ...sobrescribir }) }],
      exports: [ENTORNO],
    };
  }
}
