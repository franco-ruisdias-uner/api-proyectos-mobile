// Variables de entorno: se leen y se validan una sola vez, al arrancar.
// Si falta algo o está mal, la API no arranca y dice en castellano qué arreglar.

import {
  type ConfiguracionS3,
  configuracionS3,
  esProblemas,
} from '../comun/archivos/proveedores.js';
import {
  type ModoSsl,
  configuracionBase,
  hayProblemasDb,
} from '../comun/db/proveedores.js';

export const MOTORES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export type Motor = (typeof MOTORES)[number];

export type ProveedorArchivos =
  'local' | 'aws' | 'supabase' | 'r2' | 'b2' | 's3proxy' | 'localstack';

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;
export type NombreEntorno = (typeof ENTORNOS)[number];

export type ModoNotificaciones = 'expo' | 'registro';

export const SECRETO_DE_DESARROLLO =
  'solo-para-desarrollo-no-usar-en-produccion';

export interface Entorno {
  PUERTO: number;
  ENTORNO: NombreEntorno;
  CONFIAR_PROXY: boolean;
  URL_PUBLICA: string | null;
  DB_MOTOR: Motor;
  DB_URL: string | null;
  /** Preset de base administrada (supabase, neon, aiven-…), o null. */
  DB_PROVEEDOR: string | null;
  DB_SSL: ModoSsl;
  DB_SSL_CA: string | null;
  /** Esquema de PostgreSQL donde van las tablas (null: el de la conexión). */
  DB_ESQUEMA: string | null;
  DB_ARCHIVO: string;
  DB_SINCRONIZAR: boolean;
  /** Sólo para tests: borra el esquema al conectar (base limpia por archivo). */
  DB_BORRAR_AL_CONECTAR: boolean;
  JWT_SECRETO: string;
  ARCHIVOS_PROVEEDOR: ProveedorArchivos;
  DIRECTORIO_ARCHIVOS: string;
  /** Configuración del cliente S3 del proveedor elegido (null con `local`). */
  ARCHIVOS_S3: ConfiguracionS3 | null;
  NOTIFICACIONES: ModoNotificaciones;
  EXPO_PUSH_URL: string;
  RELOJ_FIJO: string | null;
  SIMULACION_HABILITADA: boolean;
  SEMBRAR_SI_VACIA: boolean;
}

type Variables = Record<string, string | undefined>;

const VERDADEROS = ['true', '1', 'si', 'sí'];
const FALSOS = ['false', '0', 'no'];

function texto(v: Variables, nombre: string): string | undefined {
  const valor = v[nombre]?.trim();
  return valor === undefined || valor === '' ? undefined : valor;
}

export function leerEntorno(v: Variables): Entorno {
  const problemas: string[] = [];

  const booleano = (nombre: string, porDefecto: boolean): boolean => {
    const valor = texto(v, nombre)?.toLowerCase();
    if (valor === undefined) return porDefecto;
    if (VERDADEROS.includes(valor)) return true;
    if (FALSOS.includes(valor)) return false;
    problemas.push(
      `${nombre} tiene que ser "true" o "false" (vino "${valor}").`,
    );
    return porDefecto;
  };

  const ENTORNO = (texto(v, 'ENTORNO') ?? 'desarrollo') as NombreEntorno;
  if (!ENTORNOS.includes(ENTORNO)) {
    problemas.push(
      `ENTORNO tiene que ser uno de: ${ENTORNOS.join(', ')} (vino "${ENTORNO}").`,
    );
  }

  const textoPuerto = texto(v, 'PUERTO') ?? texto(v, 'PORT') ?? '3000';
  const PUERTO = Number(textoPuerto);
  if (!Number.isInteger(PUERTO) || PUERTO < 1 || PUERTO > 65535) {
    problemas.push(
      `PUERTO tiene que ser un número entre 1 y 65535 (vino "${textoPuerto}").`,
    );
  }

  const base = configuracionBase(v);
  if (hayProblemasDb(base)) problemas.push(...base.problemas);
  const preset = base !== null && !hayProblemasDb(base) ? base : null;

  const DB_MOTOR = (preset?.motor ??
    texto(v, 'DB_MOTOR') ??
    'better-sqlite3') as Motor;
  if (!MOTORES.includes(DB_MOTOR)) {
    problemas.push(
      `DB_MOTOR tiene que ser uno de: ${MOTORES.join(', ')} (vino "${DB_MOTOR}"). ` +
        'Si usás XAMPP, poné "mariadb".',
    );
  }
  const DB_URL = preset?.url ?? texto(v, 'DB_URL') ?? null;
  if (
    preset === null &&
    base === null &&
    DB_MOTOR !== 'better-sqlite3' &&
    MOTORES.includes(DB_MOTOR)
  ) {
    if (DB_URL === null) {
      problemas.push(
        `Falta DB_URL: con DB_MOTOR=${DB_MOTOR} hace falta la dirección de la base, ` +
          (DB_MOTOR === 'postgres'
            ? 'por ejemplo postgres://usuario:clave@localhost:5432/api.'
            : 'por ejemplo mysql://usuario:clave@localhost:3306/api.'),
      );
    } else if (!URL.canParse(DB_URL)) {
      problemas.push('DB_URL no es una dirección válida.');
    }
  }
  let DB_SSL: ModoSsl = preset?.ssl ?? 'no';
  if (preset === null && base === null) {
    const textoSsl = texto(v, 'DB_SSL')?.toLowerCase();
    if (textoSsl === undefined) DB_SSL = 'no';
    else if (['no', 'si', 'si-sin-verificar'].includes(textoSsl))
      DB_SSL = textoSsl as ModoSsl;
    else
      problemas.push(
        `DB_SSL tiene que ser "no", "si" o "si-sin-verificar" (vino "${textoSsl}").`,
      );
  }
  const DB_ESQUEMA =
    preset !== null
      ? preset.esquema
      : DB_MOTOR === 'postgres'
        ? (texto(v, 'DB_ESQUEMA') ?? null)
        : null;

  const JWT_SECRETO = texto(v, 'JWT_SECRETO');
  if (JWT_SECRETO === undefined) {
    problemas.push(
      'Falta JWT_SECRETO: es la clave con la que se firman las sesiones. ' +
        'Copiá .env.example a .env, que trae una de desarrollo.',
    );
  }

  const ARCHIVOS_PROVEEDOR = (texto(v, 'ARCHIVOS_PROVEEDOR') ??
    'local') as ProveedorArchivos;
  const archivosS3 = configuracionS3(v);
  if (esProblemas(archivosS3)) problemas.push(...archivosS3.problemas);

  const NOTIFICACIONES = (texto(v, 'NOTIFICACIONES') ??
    'registro') as ModoNotificaciones;
  if (!['expo', 'registro'].includes(NOTIFICACIONES)) {
    problemas.push(
      `NOTIFICACIONES tiene que ser "expo" o "registro" (vino "${NOTIFICACIONES}").`,
    );
  }

  const EXPO_PUSH_URL =
    texto(v, 'EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
  if (!URL.canParse(EXPO_PUSH_URL)) {
    problemas.push('EXPO_PUSH_URL no es una dirección válida.');
  }

  const URL_PUBLICA = texto(v, 'URL_PUBLICA')?.replace(/\/+$/, '') ?? null;
  if (URL_PUBLICA !== null && !/^https?:\/\/[^/]+$/.test(URL_PUBLICA)) {
    problemas.push(
      `URL_PUBLICA tiene que ser algo como http://192.168.0.10:3000, sin ruta (vino "${URL_PUBLICA}").`,
    );
  }

  const RELOJ_FIJO = texto(v, 'RELOJ_FIJO') ?? null;
  if (
    RELOJ_FIJO !== null &&
    (!/(Z|[+-]\d{2}:\d{2})$/.test(RELOJ_FIJO) ||
      Number.isNaN(new Date(RELOJ_FIJO).getTime()))
  ) {
    problemas.push(
      `RELOJ_FIJO tiene que ser una fecha y hora con zona, como 2026-09-15T08:00:00-03:00 (vino "${RELOJ_FIJO}").`,
    );
  }

  const SIMULACION_HABILITADA = booleano(
    'SIMULACION_HABILITADA',
    ENTORNO === 'desarrollo',
  );

  const entorno: Entorno = {
    PUERTO,
    ENTORNO,
    CONFIAR_PROXY: booleano('CONFIAR_PROXY', false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_PROVEEDOR: preset?.proveedor ?? null,
    DB_SSL,
    DB_SSL_CA: preset?.sslCa ?? texto(v, 'DB_SSL_CA') ?? null,
    DB_ESQUEMA,
    DB_ARCHIVO: texto(v, 'DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR: booleano('DB_SINCRONIZAR', true),
    DB_BORRAR_AL_CONECTAR: booleano('DB_BORRAR_AL_CONECTAR', false),
    JWT_SECRETO: JWT_SECRETO ?? '',
    ARCHIVOS_PROVEEDOR,
    DIRECTORIO_ARCHIVOS: texto(v, 'DIRECTORIO_ARCHIVOS') ?? './archivos',
    ARCHIVOS_S3:
      archivosS3 === null || esProblemas(archivosS3) ? null : archivosS3,
    NOTIFICACIONES,
    EXPO_PUSH_URL,
    RELOJ_FIJO,
    SIMULACION_HABILITADA,
    SEMBRAR_SI_VACIA: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (ENTORNO === 'publicado') {
    const pub = (texto_: string) =>
      problemas.push(`ENTORNO=publicado: ${texto_}`);
    if (DB_MOTOR === 'better-sqlite3')
      pub(
        'la base no puede ser SQLite, porque el disco del host se borra en cada reinicio. ' +
          'Usá DB_PROVEEDOR=supabase (o neon, aiven-…) con su DB_URL.',
      );
    if (ARCHIVOS_PROVEEDOR === 'local')
      pub(
        'los archivos no pueden ser "local", porque el disco del host se borra en cada reinicio. ' +
          'Usá ARCHIVOS_PROVEEDOR=supabase (o r2, b2, aws).',
      );
    if (JWT_SECRETO !== undefined) {
      if (JWT_SECRETO === SECRETO_DE_DESARROLLO)
        pub('JWT_SECRETO es el de desarrollo. Poné uno propio y secreto.');
      else if (JWT_SECRETO.length < 32)
        pub(
          'JWT_SECRETO tiene que tener al menos 32 caracteres (generá uno largo y al azar).',
        );
    }
    if (SIMULACION_HABILITADA)
      pub(
        'poné SIMULACION_HABILITADA=false: la simulación de fallas es sólo para desarrollo.',
      );
  }

  if (problemas.length > 0) {
    throw new Error(
      'La API no puede arrancar porque hay problemas con la configuración (archivo .env):\n' +
        problemas.map((p) => `  - ${p}`).join('\n'),
    );
  }
  return entorno;
}
