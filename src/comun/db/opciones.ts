import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Entorno } from '../../config/entorno.js';

/** Las opciones de TypeORM para cada motor salen de acá y de ningún otro lado. */
export function opcionesDeBase(entorno: Entorno): TypeOrmModuleOptions {
  const comunes = {
    autoLoadEntities: true,
    synchronize: entorno.DB_SINCRONIZAR,
    dropSchema: entorno.DB_BORRAR_AL_CONECTAR,
    retryAttempts: entorno.ENTORNO === 'test' ? 0 : 10,
    retryDelay: 3000,
    logging: ['error'] as ('error' | 'warn')[],
  };

  switch (entorno.DB_MOTOR) {
    case 'better-sqlite3': {
      if (entorno.DB_ARCHIVO !== ':memory:') {
        mkdirSync(dirname(entorno.DB_ARCHIVO), { recursive: true });
      }
      return {
        ...comunes,
        type: 'better-sqlite3',
        database: entorno.DB_ARCHIVO,
      };
    }
    case 'postgres':
      return { ...comunes, type: 'postgres', url: entorno.DB_URL ?? undefined };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: entorno.DB_MOTOR,
        url: entorno.DB_URL ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4',
      };
  }
}
