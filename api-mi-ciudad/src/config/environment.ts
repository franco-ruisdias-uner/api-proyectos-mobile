import {
  PROVEEDORES_ARCHIVOS,
  type ConfiguracionS3,
  type ProveedorArchivosElegido,
  configuracionS3,
} from '../common/files/providers.js';
import { type ModoSsl, type Motor, type ProveedorBase, configuracionBase } from '../common/db/providers.js';
import { leerInstante } from '../common/dates/dates.js';

export { MOTORES, type Motor } from '../common/db/providers.js';
export { PROVEEDORES_ARCHIVOS };
export type ProveedorArchivosDisponible = ProveedorArchivosElegido;

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;

export interface Entorno {
  ENTORNO: (typeof ENTORNOS)[number];
  PUERTO: number;
  CONFIAR_PROXY: boolean;
  URL_PUBLICA: string | null;
  DB_MOTOR: Motor;
  DB_URL: string | null;
  DB_ARCHIVO: string;
  DB_SINCRONIZAR: boolean;
  /** Preset de base administrada (Supabase, Neon, Aiven), o `null`. */
  DB_PROVEEDOR: ProveedorBase | null;
  DB_SSL: ModoSsl;
  DB_SSL_CA: string | null;
  /** Esquema de PostgreSQL donde van las tablas, o `null` para el de siempre. */
  DB_ESQUEMA: string | null;
  JWT_SECRETO: string;
  ARCHIVOS_PROVEEDOR: ProveedorArchivosDisponible;
  /** Configuración del cliente S3 del proveedor elegido; `null` con `local`. */
  ALMACEN_S3: ConfiguracionS3 | null;
  DIRECTORIO_ARCHIVOS: string;
  NOTIFICACIONES: 'expo' | 'registro';
  /** Dirección de la API de push de Expo (los tests apuntan a un servidor falso). */
  EXPO_PUSH_URL: string;
  RELOJ_FIJO: Date | null;
  SIMULACION_HABILITADA: boolean;
  SEMBRAR_SI_VACIA: boolean;
}

type Crudo = Record<string, string | undefined>;

class ErrorDeEntorno extends Error {}

function texto(e: Crudo, nombre: string): string | undefined {
  const valor = e[nombre]?.trim();
  return valor === '' ? undefined : valor;
}

function booleano(e: Crudo, nombre: string, porDefecto: boolean): boolean {
  const valor = texto(e, nombre);
  if (valor === undefined) return porDefecto;
  if (['true', '1', 'si', 'sí'].includes(valor.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(valor.toLowerCase())) return false;
  throw new ErrorDeEntorno(`${nombre} tiene que ser "true" o "false" (dice "${valor}").`);
}

function opcion<T extends string>(e: Crudo, nombre: string, validas: readonly T[], porDefecto: T): T {
  const valor = texto(e, nombre) ?? porDefecto;
  if (!validas.includes(valor as T)) {
    throw new ErrorDeEntorno(`${nombre} tiene que ser uno de: ${validas.join(', ')} (dice "${valor}").`);
  }
  return valor as T;
}

function puerto(e: Crudo): number {
  const nombre = texto(e, 'PUERTO') !== undefined ? 'PUERTO' : 'PORT';
  const valor = texto(e, nombre);
  if (valor === undefined) return 3000;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new ErrorDeEntorno(
      `${nombre} tiene que ser un número de puerto entre 1 y 65535 (dice "${valor}").`,
    );
  }
  return n;
}

/**
 * Valida las variables de entorno. Si algo falta o está mal, tira un error que dice en
 * castellano qué hay que cambiar: la API no arranca con una configuración rota.
 */
export function validarEntorno(e: Crudo): Entorno {
  const errores: string[] = [];
  const intentar = <T>(fn: () => T, porDefecto: T): T => {
    try {
      return fn();
    } catch (error) {
      if (!(error instanceof ErrorDeEntorno)) throw error;
      errores.push(error.message);
      return porDefecto;
    }
  };

  const ENTORNO = intentar(() => opcion(e, 'ENTORNO', ENTORNOS, 'desarrollo'), 'desarrollo');
  const base = configuracionBase(e);
  if ('error' in base) errores.push(base.error);
  const DB_MOTOR: Motor = 'error' in base ? 'better-sqlite3' : base.motor;
  const DB_URL = 'error' in base ? null : base.url;
  const JWT_SECRETO = texto(e, 'JWT_SECRETO');
  if (!JWT_SECRETO) {
    errores.push('Falta JWT_SECRETO: copiá .env.example a .env, que ya trae uno para desarrollo.');
  }
  const URL_PUBLICA = intentar(() => {
    const valor = texto(e, 'URL_PUBLICA');
    if (valor === undefined) return null;
    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      throw new ErrorDeEntorno(
        `URL_PUBLICA tiene que ser una dirección como https://mi-api.onrender.com (dice "${valor}").`,
      );
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ErrorDeEntorno('URL_PUBLICA tiene que empezar con http:// o https://.');
    }
    return valor.replace(/\/+$/, '');
  }, null);
  const RELOJ_FIJO = intentar(() => {
    const valor = texto(e, 'RELOJ_FIJO');
    if (valor === undefined) return null;
    const instante = leerInstante(valor);
    if (!instante) {
      throw new ErrorDeEntorno(
        `RELOJ_FIJO tiene que ser un instante como 2026-11-14T21:00:00-03:00 (dice "${valor}").`,
      );
    }
    return instante;
  }, null);

  const ARCHIVOS_PROVEEDOR = intentar(
    () => opcion(e, 'ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local'),
    'local',
  );
  let ALMACEN_S3: ConfiguracionS3 | null = null;
  if (ARCHIVOS_PROVEEDOR !== 'local') {
    const s3 = configuracionS3(ARCHIVOS_PROVEEDOR, e);
    if ('error' in s3) errores.push(s3.error);
    else ALMACEN_S3 = s3;
  }

  const entorno: Entorno = {
    ENTORNO,
    PUERTO: intentar(() => puerto(e), 3000),
    CONFIAR_PROXY: intentar(() => booleano(e, 'CONFIAR_PROXY', false), false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_PROVEEDOR: 'error' in base ? null : base.proveedor,
    DB_SSL: 'error' in base ? 'no' : base.ssl,
    DB_SSL_CA: 'error' in base ? null : base.sslCa,
    DB_ESQUEMA: 'error' in base ? null : base.esquema,
    DB_ARCHIVO: texto(e, 'DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR: intentar(() => booleano(e, 'DB_SINCRONIZAR', true), true),
    JWT_SECRETO: JWT_SECRETO ?? '',
    ARCHIVOS_PROVEEDOR,
    ALMACEN_S3,
    DIRECTORIO_ARCHIVOS: texto(e, 'DIRECTORIO_ARCHIVOS') ?? 'archivos',
    NOTIFICACIONES: intentar(
      () => opcion(e, 'NOTIFICACIONES', ['expo', 'registro'] as const, 'expo'),
      'expo',
    ),
    EXPO_PUSH_URL: texto(e, 'EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send',
    RELOJ_FIJO,
    SIMULACION_HABILITADA: intentar(
      () => booleano(e, 'SIMULACION_HABILITADA', ENTORNO === 'desarrollo'),
      false,
    ),
    SEMBRAR_SI_VACIA: intentar(() => booleano(e, 'SEMBRAR_SI_VACIA', false), false),
  };

  if (ENTORNO === 'publicado') errores.push(...problemasDePublicacion(entorno));

  if (errores.length > 0) {
    throw new Error(
      `La API no puede arrancar porque la configuración tiene problemas:\n  - ${errores.join('\n  - ')}\n` +
        'Revisá el archivo .env (hay un ejemplo comentado en .env.example).',
    );
  }
  return entorno;
}

/**
 * `ENTORNO=publicado` no arranca con una configuración que sólo sirve en la computadora del
 * grupo: en un host, el disco se borra en cada reinicio (AGENTS §18.2).
 */
function problemasDePublicacion(entorno: Entorno): string[] {
  const problemas: string[] = [];
  if (entorno.DB_MOTOR === 'better-sqlite3') {
    problemas.push(
      'Con ENTORNO=publicado no se puede usar SQLite: el disco del servidor se borra en cada reinicio. ' +
        'Usá una base en la nube (DB_PROVEEDOR=supabase y DB_URL).',
    );
  }
  if (entorno.ARCHIVOS_PROVEEDOR === 'local') {
    problemas.push(
      'Con ENTORNO=publicado no se pueden guardar los archivos en disco (se pierden en cada reinicio). ' +
        'Elegí un servicio: ARCHIVOS_PROVEEDOR=supabase (o aws, r2, b2).',
    );
  }
  if (entorno.JWT_SECRETO.length < 32 || /desarrollo/i.test(entorno.JWT_SECRETO)) {
    problemas.push(
      'Con ENTORNO=publicado, JWT_SECRETO tiene que ser propio, de al menos 32 caracteres, y no el de ' +
        "desarrollo. Generá uno con: node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"",
    );
  }
  if (entorno.SIMULACION_HABILITADA) {
    problemas.push('Con ENTORNO=publicado, SIMULACION_HABILITADA tiene que ser false.');
  }
  return problemas;
}
