import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Entorno } from '../../config/entorno.js';

/** Las opciones de TypeORM de cada motor, en un solo lugar (AGENTS §5.1). */
export function opcionesTypeOrm(entorno: Entorno): TypeOrmModuleOptions {
  const enTest = entorno.ENTORNO === 'test';
  const comunes = {
    autoLoadEntities: true,
    synchronize: entorno.DB_SINCRONIZAR,
    // En los tests cada app arranca con la base vacía.
    dropSchema: enTest,
    logging: ['error' as const],
    retryAttempts: enTest ? 2 : 20,
    retryDelay: enTest ? 500 : 3000,
  };
  switch (entorno.DB_MOTOR) {
    case 'better-sqlite3':
      if (entorno.DB_ARCHIVO !== ':memory:') mkdirSync(dirname(entorno.DB_ARCHIVO), { recursive: true });
      return { ...comunes, type: 'better-sqlite3', database: entorno.DB_ARCHIVO };
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
