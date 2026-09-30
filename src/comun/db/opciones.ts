// Opciones de TypeORM por motor: la única función que sabe de motores (AGENTS §5.1).
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { Entorno } from '../../config/entorno.js';
import { ErrorDeConfiguracion } from '../../config/entorno.js';
import { motorDeColumnas } from './columnas.js';

/** Opciones `ssl` del driver: false, o cifrado con o sin verificar el certificado. */
function opcionesSsl(
  entorno: Entorno,
): false | { rejectUnauthorized: boolean; ca?: string } {
  const { ssl, sslCa } = entorno.BASE;
  if (ssl === 'no') return false;
  if (ssl === 'si-sin-verificar') return { rejectUnauthorized: false };
  if (sslCa === null) return { rejectUnauthorized: true };
  try {
    return { rejectUnauthorized: true, ca: readFileSync(sslCa, 'utf8') };
  } catch {
    throw new ErrorDeConfiguracion([
      `No se pudo leer DB_SSL_CA (${sslCa}): revisá que la ruta al certificado de la CA del proveedor sea correcta.`,
    ]);
  }
}

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

  const { conexion } = entorno.BASE;
  const ssl = opcionesSsl(entorno);
  // Con un preset, la URL ya se descompuso y decodificó (la contraseña puede traer @ o /).
  const destino = conexion
    ? {
        host: conexion.host,
        port: conexion.port,
        username: conexion.username,
        password: conexion.password,
        database: conexion.database,
      }
    : { url: entorno.DB_URL ?? undefined };

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
      return {
        ...comunes,
        type: 'postgres',
        ...destino,
        ssl,
        ...(entorno.BASE.esquema ? { schema: entorno.BASE.esquema } : {}),
      };
    case 'mysql':
    case 'mariadb':
      return {
        ...comunes,
        type: entorno.DB_MOTOR,
        ...destino,
        ...(ssl ? { ssl } : {}),
        timezone: 'Z',
        charset: 'utf8mb4',
      };
  }
}

/**
 * DataSource de la app. En PostgreSQL con un esquema propio (DB_ESQUEMA), lo crea si no existe
 * antes de sincronizar las tablas (sin SQL a mano: `queryRunner.createSchema`).
 */
export async function crearDataSource(
  opciones: DataSourceOptions,
): Promise<DataSource> {
  const dataSource = new DataSource({ ...opciones, synchronize: false });
  try {
    await dataSource.initialize();
    if (opciones.type === 'postgres' && opciones.schema) {
      const corredor = dataSource.createQueryRunner();
      try {
        await corredor.createSchema(opciones.schema, true);
      } finally {
        await corredor.release();
      }
    }
    if (opciones.synchronize) await dataSource.synchronize();
  } catch (e) {
    if (dataSource.isInitialized) await dataSource.destroy();
    throw e;
  }
  return dataSource;
}
