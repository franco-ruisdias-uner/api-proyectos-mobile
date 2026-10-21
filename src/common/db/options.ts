import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import type { Configuracion } from '../../config/environment.js';
import { conexionDeUrl } from './providers.js';

/** `ssl` de pg y mysql2 según DB_SSL / DB_SSL_CA (AGENTS §18.1). */
function opcionesSsl(
  config: Configuracion,
): { rejectUnauthorized: boolean; ca?: string } | undefined {
  const { ssl, sslCa } = config.db;
  if (ssl === 'no') return undefined;
  let ca: string | undefined;
  if (sslCa) {
    try {
      ca = readFileSync(sslCa, 'utf8');
    } catch (error) {
      throw new Error(
        `No se pudo leer el certificado de DB_SSL_CA ("${sslCa}"). Descargalo del panel de tu proveedor y poné la ruta del archivo.`,
        { cause: error },
      );
    }
  }
  return { rejectUnauthorized: ssl === 'si', ...(ca ? { ca } : {}) };
}

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
    case 'postgres': {
      const c = conexionDeUrl(config.db.url!);
      return {
        ...comunes,
        type: 'postgres',
        host: c.host,
        port: c.puerto,
        username: c.usuario,
        password: c.contrasena,
        database: c.base,
        ssl: opcionesSsl(config),
        schema: config.db.esquema ?? undefined,
      };
    }
    case 'mysql':
    case 'mariadb': {
      const c = conexionDeUrl(config.db.url!);
      return {
        ...comunes,
        type: config.db.motor,
        host: c.host,
        port: c.puerto,
        username: c.usuario,
        password: c.contrasena,
        database: c.base,
        ssl: opcionesSsl(config),
        timezone: 'Z',
        charset: 'utf8mb4_unicode_ci',
      };
    }
  }
}

/**
 * Crea el DataSource. En PostgreSQL con DB_ESQUEMA, crea el esquema si no existe antes de
 * sincronizar (AGENTS §18.1). Si el servidor rechaza el certificado, lo explica.
 */
export async function crearDataSource(opciones: DataSourceOptions): Promise<DataSource> {
  const esquema = opciones.type === 'postgres' ? opciones.schema : undefined;
  const dataSource = new DataSource({ ...opciones, synchronize: false } as DataSourceOptions);
  try {
    await dataSource.initialize();
    if (esquema) {
      const ejecutor = dataSource.createQueryRunner();
      try {
        await ejecutor.createSchema(esquema, true);
      } finally {
        await ejecutor.release();
      }
    }
    if (opciones.synchronize) await dataSource.synchronize();
  } catch (error) {
    if (dataSource.isInitialized) await dataSource.destroy();
    throw explicarErrorDeConexion(error);
  }
  return dataSource;
}

/** Traduce los errores típicos de la conexión a algo que un alumno pueda arreglar. */
export function explicarErrorDeConexion(error: unknown): Error {
  const mensaje = error instanceof Error ? error.message : String(error);
  const codigo = (error as { code?: string } | null)?.code ?? '';
  const ayuda = (texto: string) => new Error(texto, { cause: error });
  if (/self[- ]signed|unable to verify|certificate|CERT_/i.test(mensaje + codigo)) {
    return ayuda(
      'El certificado del servidor de base de datos no se pudo verificar. Probá con DB_SSL=si-sin-verificar ' +
        '(cifra sin verificar, como sslmode=require) o poné en DB_SSL_CA la ruta al certificado de la CA de tu proveedor.',
    );
  }
  if (
    /password authentication failed|Access denied|28P01|ER_ACCESS_DENIED/i.test(mensaje + codigo)
  ) {
    return ayuda(
      'La base de datos rechazó el usuario o la contraseña de DB_URL. Revisalos en el panel de tu proveedor.',
    );
  }
  if (/prepared statement|pgbouncer|transaction pooler/i.test(mensaje)) {
    return ayuda(
      'Parece que DB_URL apunta al pooler en modo transacción. Usá el de modo sesión (puerto 5432).',
    );
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(mensaje + codigo)) {
    return ayuda(
      'No se encontró el servidor de DB_URL. Revisá la dirección y tu conexión a internet.',
    );
  }
  if (/ECONNREFUSED|ETIMEDOUT/.test(mensaje + codigo)) {
    return ayuda(
      'No se pudo conectar con el servidor de DB_URL. ¿La base está encendida? (Las bases gratis se pausan sin uso: reactivala desde el panel.)',
    );
  }
  return error instanceof Error ? error : ayuda(mensaje);
}
