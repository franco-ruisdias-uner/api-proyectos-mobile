import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { Entorno } from '../../config/entorno.js';
import { explicarErrorDeBase, partesDeUrl } from './proveedores.js';

/** `false` (sin SSL) o las opciones que entienden `pg` y `mysql2` (AGENTS §18.1). */
function opcionesSsl(entorno: Entorno): false | { rejectUnauthorized: boolean; ca?: string } {
  if (entorno.dbSsl === 'no') return false;
  const ca = entorno.dbSslCa ? readFileSync(entorno.dbSslCa, 'utf8') : undefined;
  return { rejectUnauthorized: entorno.dbSsl === 'si', ...(ca ? { ca } : {}) };
}

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
    case 'postgres': {
      // La URL se parte con `URL` y se decodifica: una contraseña con símbolos no la rompe.
      const u = partesDeUrl(entorno.dbUrl ?? '');
      return {
        ...comunes,
        type: 'postgres',
        host: u.host,
        port: u.puerto,
        username: u.usuario,
        password: u.clave,
        database: u.base,
        ssl: opcionesSsl(entorno),
        ...(entorno.dbEsquema ? { schema: entorno.dbEsquema } : {}),
      };
    }
    case 'mysql':
    case 'mariadb': {
      const u = partesDeUrl(entorno.dbUrl ?? '');
      const ssl = opcionesSsl(entorno);
      return {
        ...comunes,
        type: entorno.dbMotor,
        host: u.host,
        port: u.puerto,
        username: u.usuario,
        password: u.clave,
        database: u.base,
        timezone: 'Z',
        charset: 'utf8mb4',
        ...(ssl ? { ssl } : {}),
      };
    }
  }
}

/**
 * PostgreSQL con `DB_ESQUEMA`: crea el esquema si no existe, antes de que `synchronize` cree las
 * tablas (sin SQL a mano: `queryRunner.createSchema`).
 */
export async function crearEsquemaSiHaceFalta(
  opciones: DataSourceOptions,
  entorno: Entorno,
): Promise<void> {
  if (entorno.dbMotor !== 'postgres' || !entorno.dbEsquema) return;
  const previa = new DataSource({
    ...opciones,
    entities: [],
    synchronize: false,
  } as DataSourceOptions);
  try {
    await previa.initialize();
    const runner = previa.createQueryRunner();
    try {
      await runner.createSchema(entorno.dbEsquema, true);
    } finally {
      await runner.release();
    }
  } catch (error) {
    throw new Error(
      `No se pudo preparar el esquema «${entorno.dbEsquema}»: ${explicarErrorDeBase(error as Error, entorno.dbSsl)}`,
    );
  } finally {
    if (previa.isInitialized) await previa.destroy();
  }
}
