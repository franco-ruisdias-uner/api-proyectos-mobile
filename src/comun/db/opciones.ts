import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Configuracion } from '../../config/configuracion.js';

/** Opciones de TypeORM para cada motor, en un solo lugar (AGENTS §5.1). */
export function opcionesDeBase(
  config: Configuracion,
  extra: { reintentos?: number } = {},
): TypeOrmModuleOptions {
  const comunes = {
    autoLoadEntities: true,
    synchronize: config.db.sincronizar,
    retryAttempts: extra.reintentos ?? 10,
    retryDelay: 3000,
    logging: ['error' as const],
  };

  switch (config.db.motor) {
    case 'better-sqlite3': {
      const archivo = config.db.archivo;
      if (archivo !== ':memory:') mkdirSync(dirname(archivo), { recursive: true });
      return { ...comunes, type: 'better-sqlite3', database: archivo };
    }
    case 'postgres':
      return { ...comunes, type: 'postgres', url: config.db.url ?? undefined };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: config.db.motor,
        url: config.db.url ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4_unicode_ci',
      };
  }
}
