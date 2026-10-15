import { type ConfigType, registerAs } from '@nestjs/config';
import { dbPresetFromEnv, hasDbProblems } from '../comun/db/proveedores.js';
import { type Env, validateEnv } from './env.validation.js';

// La base de datos. Con DB_PROVIDER (supabase, neon, aiven-…) el preset completa motor, SSL
// y esquema; sin él, se usa DB_ENGINE con DB_URL (o DB_FILE para SQLite).

export function buildDatabaseConfig(env: Env) {
  const result = dbPresetFromEnv(env);
  // validateEnv ya rechazó un preset con problemas: acá es un preset válido o ninguno.
  const preset = result !== null && !hasDbProblems(result) ? result : null;
  const engine = preset?.engine ?? env.DB_ENGINE ?? 'better-sqlite3';
  return {
    engine,
    url: preset?.url ?? env.DB_URL ?? null,
    /** Preset de base administrada, o null. */
    provider: preset?.provider ?? null,
    ssl: preset?.ssl ?? env.DB_SSL ?? 'off',
    sslCa: preset?.sslCa ?? env.DB_SSL_CA ?? null,
    /** Esquema de PostgreSQL para las tablas (null: el de la conexión). */
    schema: preset
      ? preset.schema
      : engine === 'postgres'
        ? (env.DB_SCHEMA ?? null)
        : null,
    /** Archivo de SQLite (`:memory:` en los tests). */
    file: env.DB_FILE,
    synchronize: env.DB_SYNCHRONIZE,
    dropSchema: env.DB_DROP_SCHEMA,
    /** En los tests una base caída tiene que fallar enseguida, no reintentar. */
    retryAttempts: env.APP_ENV === 'test' ? 0 : 10,
  };
}

export const databaseConfig = registerAs('database', () =>
  buildDatabaseConfig(validateEnv(process.env)),
);
export type DatabaseConfig = ConfigType<typeof databaseConfig>;
