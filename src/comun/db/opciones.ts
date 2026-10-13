import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
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
      return {
        ...comunes,
        type: 'postgres',
        url: entorno.DB_URL ?? undefined,
        ssl: opcionesSsl(entorno),
        ...(entorno.DB_ESQUEMA ? { schema: entorno.DB_ESQUEMA } : {}),
      };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: entorno.DB_MOTOR,
        url: entorno.DB_URL ?? undefined,
        timezone: 'Z',
        charset: 'utf8mb4',
        ssl: opcionesSsl(entorno),
      };
  }
}

/**
 * `no` → sin SSL. `si-sin-verificar` → cifra sin verificar el certificado (como sslmode=require),
 * salvo que haya DB_SSL_CA: ahí verifica contra esa CA. `si` → cifra y verifica.
 */
function opcionesSsl(
  entorno: Entorno,
): false | { rejectUnauthorized: boolean; ca?: string } {
  if (entorno.DB_SSL === 'no') return false;
  const ca = entorno.DB_SSL_CA ? leerCa(entorno.DB_SSL_CA) : undefined;
  const verificar = entorno.DB_SSL === 'si' || ca !== undefined;
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
 * Crea el DataSource. En PostgreSQL con esquema propio (DB_ESQUEMA), primero crea el esquema
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
