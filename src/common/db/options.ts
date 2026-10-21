// Opciones de TypeORM por motor: una sola función para los cuatro (AGENTS §5.1).
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Configuracion } from '../../config/environment.js';

/** Opciones de SSL según DB_SSL / DB_SSL_CA (AGENTS §18.1); undefined = sin cifrar. */
function opcionesSsl(
  config: Configuracion,
): { rejectUnauthorized: boolean; ca?: string } | undefined {
  if (config.db.ssl === 'no') return undefined;
  return {
    rejectUnauthorized: config.db.ssl === 'si',
    ...(config.db.sslCa ? { ca: readFileSync(config.db.sslCa, 'utf8') } : {}),
  };
}

export function opcionesDeBase(
  config: Configuracion,
  extra: { borrarEsquema?: boolean } = {},
): TypeOrmModuleOptions {
  const comunes = {
    autoLoadEntities: true,
    synchronize: config.db.sincronizar,
    dropSchema: extra.borrarEsquema ?? false,
    // La base puede tardar en aceptar conexiones aunque Docker diga "healthy".
    retryAttempts: config.entorno === 'test' ? 0 : 10,
    retryDelay: 3000,
    logging: ['error'] as 'error'[],
  };
  switch (config.db.motor) {
    case 'better-sqlite3': {
      if (config.db.archivo !== ':memory:')
        mkdirSync(dirname(config.db.archivo), { recursive: true });
      return {
        ...comunes,
        type: 'better-sqlite3',
        database: config.db.archivo,
      };
    }
    case 'postgres':
      return {
        ...comunes,
        type: 'postgres',
        url: config.db.url ?? undefined,
        ssl: opcionesSsl(config),
        ...(config.db.esquema ? { schema: config.db.esquema } : {}),
      };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: config.db.motor,
        url: config.db.url ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4',
        ssl: opcionesSsl(config),
      };
  }
}
