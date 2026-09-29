// Opciones de TypeORM por motor: la única función que sabe de motores (AGENTS §5.1).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { Entorno } from '../../config/entorno.js';
import { ErrorDeConfiguracion } from '../../config/entorno.js';
import { motorDeColumnas } from './columnas.js';

export function opcionesTypeOrm(entorno: Entorno): TypeOrmModuleOptions {
  if (entorno.DB_MOTOR !== motorDeColumnas()) {
    throw new ErrorDeConfiguracion([
      `DB_MOTOR tiene que estar definido antes de arrancar (en .env o en el entorno): las tablas se declararon para ${motorDeColumnas()} y la configuración dice ${entorno.DB_MOTOR}.`,
    ]);
  }

  const comunes = {
    autoLoadEntities: true,
    synchronize: entorno.DB_SINCRONIZAR,
    retryAttempts: entorno.ENTORNO === 'test' ? 0 : 10,
    retryDelay: 3000,
    logging: ['error' as const],
  };

  switch (entorno.DB_MOTOR) {
    case 'better-sqlite3': {
      if (entorno.DB_ARCHIVO !== ':memory:')
        mkdirSync(dirname(entorno.DB_ARCHIVO), { recursive: true });
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
