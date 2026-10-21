import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { DatabaseConfig } from '../../config/database.config.js';
import { usarTipoDeInstante } from './columns.js';

/** Las opciones de TypeORM para cada motor salen de acá y de ningún otro lado. */
export function opcionesDeBase(db: DatabaseConfig): TypeOrmModuleOptions {
  // Antes de que TypeORM arme el esquema: las columnas de instantes según el motor.
  usarTipoDeInstante(db.engine);
  const comunes = {
    autoLoadEntities: true,
    synchronize: db.synchronize,
    dropSchema: db.dropSchema,
    retryAttempts: db.retryAttempts,
    retryDelay: 3000,
    logging: ['error'] as ('error' | 'warn')[],
  };

  switch (db.engine) {
    case 'better-sqlite3': {
      if (db.file !== ':memory:') {
        mkdirSync(dirname(db.file), { recursive: true });
      }
      return {
        ...comunes,
        type: 'better-sqlite3',
        database: db.file,
      };
    }
    case 'postgres':
      return {
        ...comunes,
        type: 'postgres',
        url: db.url ?? undefined,
        ssl: opcionesSsl(db),
        ...(db.schema ? { schema: db.schema } : {}),
      };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: db.engine,
        url: db.url ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4',
        ssl: opcionesSsl(db),
      };
  }
}

/**
 * `off` → sin SSL. `no-verify` → cifra sin verificar el certificado (como sslmode=require),
 * salvo que haya DB_SSL_CA: ahí verifica contra esa CA. `verify` → cifra y verifica.
 */
function opcionesSsl(
  db: DatabaseConfig,
): false | { rejectUnauthorized: boolean; ca?: string } {
  if (db.ssl === 'off') return false;
  const ca = db.sslCa ? leerCa(db.sslCa) : undefined;
  const verificar = db.ssl === 'verify' || ca !== undefined;
  return { rejectUnauthorized: verificar, ...(ca ? { ca } : {}) };
}

function leerCa(ruta: string): string {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    throw new Error(
      `No se pudo leer el certificado de DB_SSL_CA (${ruta}). Revisá la ruta: es el archivo .pem que baja el panel del proveedor.`,
    );
  }
}

/**
 * Crea el DataSource. En PostgreSQL con esquema propio (DB_SCHEMA), primero crea el esquema
 * si no existe (`queryRunner.createSchema`, sin SQL a mano) y recién después conecta con él.
 */
export async function crearDataSource(
  opciones: DataSourceOptions,
): Promise<DataSource> {
  if (opciones.type === 'postgres' && opciones.schema) {
    const previo = new DataSource({
      type: 'postgres',
      url: opciones.url,
      ssl: opciones.ssl,
      extra: opciones.extra,
    });
    await previo.initialize();
    try {
      const runner = previo.createQueryRunner();
      try {
        await runner.createSchema(String(opciones.schema), true);
      } finally {
        await runner.release();
      }
    } finally {
      await previo.destroy();
    }
  }
  return new DataSource(opciones).initialize();
}
