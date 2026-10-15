// Variables de entorno: se validan una sola vez, con Zod, cuando arranca ConfigModule.
// Si falta algo o está mal, la API no arranca y dice en castellano qué arreglar.
// Este archivo sólo valida y convierte tipos: armar la configuración de cada área
// (base, archivos, auth…) es trabajo de los `*.config.ts`.

import { z } from 'zod';
import {
  hasS3Problems,
  s3ConfigFromEnv,
} from '../comun/archivos/proveedores.js';
import {
  dbPresetFromEnv,
  hasDbProblems,
  SCHEMA_NAME,
} from '../comun/db/proveedores.js';

export const APP_ENVS = ['development', 'test', 'production'] as const;
export const DB_ENGINES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export const DB_SSL_MODES = ['off', 'verify', 'no-verify'] as const;
export const STORAGE_PROVIDERS = [
  'local',
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];
export const PUSH_PROVIDERS = ['expo', 'log'] as const;
export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const;
export const LOG_FORMATS = ['text', 'json'] as const;

export const DEVELOPMENT_JWT_SECRET =
  'solo-para-desarrollo-no-usar-en-produccion';

// ── Piezas reutilizables ──────────────────────────────────────────────────────

const TRUE_VALUES = ['true', '1', 'yes'];
const FALSE_VALUES = ['false', '0', 'no'];

/** Booleano escrito como texto en el .env ("true"/"false", "1"/"0", "yes"/"no"). */
const optionalFlag = (name: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx): boolean | undefined => {
      if (value === undefined) return undefined;
      const normalized = value.toLowerCase();
      if (TRUE_VALUES.includes(normalized)) return true;
      if (FALSE_VALUES.includes(normalized)) return false;
      ctx.addIssue({
        code: 'custom',
        message: `${name} tiene que ser "true" o "false" (vino "${value}").`,
      });
      return z.NEVER;
    });

/** Igual, pero con un valor por defecto cuando no está. */
const flag = (name: string, fallback: boolean) =>
  optionalFlag(name).transform((value) => value ?? fallback);

/** Uno de los valores de la lista, con un mensaje que dice cuáles valen. */
const oneOf = <const T extends readonly [string, ...string[]]>(
  name: string,
  values: T,
  hint = '',
) =>
  z.enum(values, {
    error: (issue) =>
      `${name} tiene que ser uno de: ${values.join(', ')} (vino "${String(issue.input)}").${hint}`,
  });

const url = (name: string, example: string) =>
  z.string().refine((value) => URL.canParse(value), {
    error: `${name} no es una dirección válida (por ejemplo ${example}).`,
  });

// ── El esquema ────────────────────────────────────────────────────────────────

export const envSchema = z.object({
  // General
  APP_ENV: oneOf('APP_ENV', APP_ENVS).default('development'),
  PORT: z.coerce
    .number({ error: 'PORT tiene que ser un número.' })
    .int({ error: 'PORT tiene que ser un número entero.' })
    .min(1, { error: 'PORT tiene que estar entre 1 y 65535.' })
    .max(65535, { error: 'PORT tiene que estar entre 1 y 65535.' })
    .default(3000),
  TRUST_PROXY: flag('TRUST_PROXY', false),
  PUBLIC_URL: z
    .string()
    .transform((value) => value.replace(/\/+$/, ''))
    .refine((value) => /^https?:\/\/[^/]+$/.test(value), {
      error:
        'PUBLIC_URL tiene que ser algo como http://192.168.0.10:3000, sin ruta.',
    })
    .optional(),
  CORS_ORIGINS: z.string().default('*'),

  // Logs
  LOG_LEVEL: oneOf('LOG_LEVEL', LOG_LEVELS).default('log'),
  /** Si no está: json en production (lo leen los hosts), text en el resto. */
  LOG_FORMAT: oneOf('LOG_FORMAT', LOG_FORMATS).optional(),

  // Límite de pedidos (por IP; el ingreso, por IP y legajo)
  THROTTLE_TTL_SECONDS: z.coerce
    .number({ error: 'THROTTLE_TTL_SECONDS tiene que ser un número.' })
    .int()
    .positive()
    .default(60),
  THROTTLE_LIMIT: z.coerce
    .number({ error: 'THROTTLE_LIMIT tiene que ser un número.' })
    .int()
    .positive()
    .default(300),
  LOGIN_THROTTLE_LIMIT: z.coerce
    .number({ error: 'LOGIN_THROTTLE_LIMIT tiene que ser un número.' })
    .int()
    .positive()
    .default(10),

  // Sesiones
  JWT_SECRET: z.string({
    error:
      'Falta JWT_SECRET: es la clave con la que se firman las sesiones. ' +
      'Copiá .env.example a .env, que trae una de desarrollo.',
  }),

  // Base de datos
  DB_ENGINE: oneOf(
    'DB_ENGINE',
    DB_ENGINES,
    ' Si usás XAMPP, poné "mariadb".',
  ).optional(),
  DB_URL: z.string().optional(),
  DB_PROVIDER: z.string().optional(),
  DB_SSL: oneOf('DB_SSL', DB_SSL_MODES).optional(),
  DB_SSL_CA: z.string().optional(),
  DB_SCHEMA: z
    .string()
    .regex(SCHEMA_NAME, {
      error:
        'DB_SCHEMA tiene que ser un nombre simple: letras, números y guion bajo, sin espacios ni símbolos.',
    })
    .optional(),
  DB_FILE: z.string().default('data/api.sqlite'),
  DB_SYNCHRONIZE: flag('DB_SYNCHRONIZE', true),
  /** Sólo para tests: borra el esquema al conectar (base limpia por archivo). */
  DB_DROP_SCHEMA: flag('DB_DROP_SCHEMA', false),
  SEED_IF_EMPTY: flag('SEED_IF_EMPTY', false),

  // Archivos
  STORAGE_PROVIDER: oneOf('STORAGE_PROVIDER', STORAGE_PROVIDERS).default(
    'local',
  ),
  STORAGE_DIR: z.string().default('./uploads'),
  STORAGE_REDIRECT: flag('STORAGE_REDIRECT', false),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: url('S3_ENDPOINT', 'https://s3.example.com').optional(),
  S3_FORCE_PATH_STYLE: optionalFlag('S3_FORCE_PATH_STYLE'),
  S3_CREATE_BUCKET: optionalFlag('S3_CREATE_BUCKET'),
  SUPABASE_PROJECT_REF: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),

  // Notificaciones push
  PUSH_PROVIDER: oneOf('PUSH_PROVIDER', PUSH_PROVIDERS).default('log'),
  EXPO_PUSH_URL: url(
    'EXPO_PUSH_URL',
    'https://exp.host/--/api/v2/push/send',
  ).default('https://exp.host/--/api/v2/push/send'),

  // Para probar
  FIXED_CLOCK: z
    .string()
    .refine(
      (value) =>
        /(Z|[+-]\d{2}:\d{2})$/.test(value) &&
        !Number.isNaN(new Date(value).getTime()),
      {
        error:
          'FIXED_CLOCK tiene que ser una fecha y hora con zona, como 2026-09-15T08:00:00-03:00.',
      },
    )
    .optional(),
  /** Si no está: prendida en development, apagada en el resto. */
  SIMULATION_ENABLED: optionalFlag('SIMULATION_ENABLED'),
});

export type Env = z.output<typeof envSchema>;

/** Texto vacío o con espacios cuenta como "no está" (así se puede dejar `VAR=` en el .env). */
function clean(
  variables: Record<string, unknown>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(variables)) {
    if (typeof value !== 'string') {
      // ConfigModule devuelve a process.env lo que ya validó (números, booleanos).
      if (value !== undefined && value !== null) result[name] = String(value);
      continue;
    }
    const trimmed = value.trim();
    if (trimmed !== '') result[name] = trimmed;
  }
  return result;
}

/** Lo que mira varias variables a la vez: los presets de base y de archivos. */
function presetProblems(raw: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  const preset = dbPresetFromEnv(raw);
  if (hasDbProblems(preset)) problems.push(...preset.problems);
  const engine = raw.DB_ENGINE ?? 'better-sqlite3';
  if (preset === null && engine !== 'better-sqlite3') {
    if (raw.DB_URL === undefined) {
      problems.push(
        `Falta DB_URL: con DB_ENGINE=${engine} hace falta la dirección de la base, ` +
          (engine === 'postgres'
            ? 'por ejemplo postgres://usuario:clave@localhost:5432/api.'
            : 'por ejemplo mysql://usuario:clave@localhost:3306/api.'),
      );
    } else if (!URL.canParse(raw.DB_URL)) {
      problems.push('DB_URL no es una dirección válida.');
    }
  }
  const s3 = s3ConfigFromEnv(raw);
  if (hasS3Problems(s3)) problems.push(...s3.problems);
  return problems;
}

/** Con APP_ENV=production la API no arranca con lo que sólo sirve en la computadora. */
function productionProblems(env: Env): string[] {
  if (env.APP_ENV !== 'production') return [];
  const problems: string[] = [];
  const prod = (message: string) =>
    problems.push(`APP_ENV=production: ${message}`);
  const usesSqlite =
    env.DB_PROVIDER === undefined &&
    (env.DB_ENGINE ?? 'better-sqlite3') === 'better-sqlite3';
  if (usesSqlite)
    prod(
      'la base no puede ser SQLite, porque el disco del host se borra en cada reinicio. ' +
        'Usá DB_PROVIDER=supabase (o neon, aiven-…) con su DB_URL.',
    );
  if (env.STORAGE_PROVIDER === 'local')
    prod(
      'los archivos no pueden ser "local", porque el disco del host se borra en cada reinicio. ' +
        'Usá STORAGE_PROVIDER=supabase (o r2, b2, aws).',
    );
  if (env.JWT_SECRET === DEVELOPMENT_JWT_SECRET)
    prod('JWT_SECRET es el de desarrollo. Poné uno propio y secreto.');
  else if (env.JWT_SECRET.length < 32)
    prod(
      'JWT_SECRET tiene que tener al menos 32 caracteres (generá uno largo y al azar).',
    );
  if (env.SIMULATION_ENABLED === true)
    prod(
      'poné SIMULATION_ENABLED=false: la simulación de fallas es sólo para desarrollo.',
    );
  return problems;
}

/**
 * Valida las variables y las devuelve con su tipo. Si hay problemas, tira un Error que los
 * lista todos juntos. ConfigModule la usa como `validate`, y los `*.config.ts` para leer.
 */
export function validateEnv(variables: Record<string, unknown>): Env {
  const raw = clean(variables);
  const parsed = envSchema.safeParse(raw);
  const problems = parsed.success
    ? productionProblems(parsed.data)
    : parsed.error.issues.map((issue) => issue.message);
  problems.push(...presetProblems(raw));
  if (parsed.success && problems.length === 0) return parsed.data;
  throw new Error(
    'La API no puede arrancar porque hay problemas con la configuración (archivo .env):\n' +
      [...new Set(problems)].map((p) => `  - ${p}`).join('\n'),
  );
}
