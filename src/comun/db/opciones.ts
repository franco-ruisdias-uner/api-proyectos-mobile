import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Entorno } from '../../config/entorno.js';

/** Opciones de TypeORM según el motor elegido (AGENTS §5.1). Una sola función para los cuatro. */
export function opcionesTypeOrm(entorno: Entorno): TypeOrmModuleOptions {
  const comunes = {
    autoLoadEntities: true,
    synchronize: entorno.dbSincronizar,
    // La API espera a que la base acepte conexiones (Docker: "healthy" no siempre alcanza).
    retryAttempts: entorno.entorno === 'test' ? 0 : 10,
    retryDelay: 3000,
    logging: ['error' as const],
  };

  switch (entorno.dbMotor) {
    case 'better-sqlite3': {
      if (entorno.dbArchivo !== ':memory:') {
        mkdirSync(dirname(entorno.dbArchivo), { recursive: true });
      }
      return { ...comunes, type: 'better-sqlite3', database: entorno.dbArchivo };
    }
    case 'postgres':
      return { ...comunes, type: 'postgres', url: entorno.dbUrl ?? undefined };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: entorno.dbMotor,
        url: entorno.dbUrl ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4',
      };
  }
}
