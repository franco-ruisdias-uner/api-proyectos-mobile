import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Entorno } from '../../config/environment.js';
import { conexionDeUrl } from './providers.js';

/** Opciones de cifrado para `pg` y `mysql2` (mismo formato en los dos). */
function opcionesSsl(entorno: Entorno): { ca?: string; rejectUnauthorized: boolean } | undefined {
  if (entorno.DB_SSL === 'no') return undefined;
  if (entorno.DB_SSL === 'si-sin-verificar') return { rejectUnauthorized: false };
  return {
    rejectUnauthorized: true,
    ...(entorno.DB_SSL_CA ? { ca: leerCa(entorno.DB_SSL_CA) } : {}),
  };
}

function leerCa(ruta: string): string {
  try {
    return readFileSync(ruta, 'utf8');
  } catch {
    throw new Error(
      `No se pudo leer el certificado de DB_SSL_CA (${ruta}). Revisá la ruta: es el archivo que baja del panel del proveedor.`,
    );
  }
}

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
    case 'postgres': {
      const c = conexionDeUrl(entorno.DB_URL ?? '', 'postgres');
      return {
        ...comunes,
        type: 'postgres',
        host: c.host,
        port: c.puerto,
        username: c.usuario,
        password: c.contrasena,
        database: c.base,
        ssl: opcionesSsl(entorno),
        ...(entorno.DB_ESQUEMA ? { schema: entorno.DB_ESQUEMA } : {}),
      };
    }
    case 'mysql':
    case 'mariadb': {
      const c = conexionDeUrl(entorno.DB_URL ?? '', entorno.DB_MOTOR);
      return {
        ...comunes,
        type: entorno.DB_MOTOR,
        host: c.host,
        port: c.puerto,
        username: c.usuario,
        password: c.contrasena,
        database: c.base,
        ssl: opcionesSsl(entorno),
        timezone: 'Z',
        charset: 'utf8mb4',
      };
    }
  }
}

type OpcionesDataSource = ConstructorParameters<typeof DataSource>[0];

/**
 * Crea el esquema de PostgreSQL (`schema` de las opciones) si no existe, sin SQL a mano: lo hace
 * TypeORM con `queryRunner.createSchema`. Va con una conexión aparte y corta, antes de que la
 * app sincronice las tablas.
 */
export async function crearEsquemaSiHaceFalta(opciones: OpcionesDataSource): Promise<void> {
  if (opciones.type !== 'postgres' || !opciones.schema) return;
  const previa = new DataSource({
    ...opciones,
    entities: [],
    synchronize: false,
    dropSchema: false,
  });
  await previa.initialize();
  try {
    const consulta = previa.createQueryRunner();
    try {
      await consulta.createSchema(opciones.schema, true);
    } finally {
      await consulta.release();
    }
  } finally {
    await previa.destroy();
  }
}

/** `dataSourceFactory` de `TypeOrmModule`: primero el esquema, después la conexión de la app. */
export async function crearDataSource(opciones: OpcionesDataSource): Promise<DataSource> {
  await crearEsquemaSiHaceFalta(opciones);
  return new DataSource(opciones);
}
