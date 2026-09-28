import { leerInstante } from '../comun/fechas/fechas.js';

export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
export type Motor = (typeof MOTORES)[number];

/** En M0 sólo está el adaptador de disco; los proveedores S3 llegan en el módulo «Nube». */
export const PROVEEDORES_ARCHIVOS = ['local'] as const;
export type ProveedorArchivosDisponible = (typeof PROVEEDORES_ARCHIVOS)[number];

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
  JWT_SECRETO: string;
  ARCHIVOS_PROVEEDOR: ProveedorArchivosDisponible;
  DIRECTORIO_ARCHIVOS: string;
  NOTIFICACIONES: 'expo' | 'registro';
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
  const DB_MOTOR = intentar(() => opcion(e, 'DB_MOTOR', MOTORES, 'better-sqlite3'), 'better-sqlite3');
  const DB_URL = texto(e, 'DB_URL') ?? null;
  if (DB_MOTOR !== 'better-sqlite3' && !DB_URL) {
    errores.push(
      `Con DB_MOTOR=${DB_MOTOR} hace falta DB_URL (por ejemplo ${
        DB_MOTOR === 'postgres'
          ? 'postgres://api:api@localhost:5432/api'
          : 'mysql://api:api@localhost:3306/api'
      }).`,
    );
  }
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

  const entorno: Entorno = {
    ENTORNO,
    PUERTO: intentar(() => puerto(e), 3000),
    CONFIAR_PROXY: intentar(() => booleano(e, 'CONFIAR_PROXY', false), false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_ARCHIVO: texto(e, 'DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR: intentar(() => booleano(e, 'DB_SINCRONIZAR', true), true),
    JWT_SECRETO: JWT_SECRETO ?? '',
    ARCHIVOS_PROVEEDOR: intentar(
      () => opcion(e, 'ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local'),
      'local',
    ),
    DIRECTORIO_ARCHIVOS: texto(e, 'DIRECTORIO_ARCHIVOS') ?? 'archivos',
    NOTIFICACIONES: intentar(
      () => opcion(e, 'NOTIFICACIONES', ['expo', 'registro'] as const, 'expo'),
      'expo',
    ),
    RELOJ_FIJO,
    SIMULACION_HABILITADA: intentar(
      () => booleano(e, 'SIMULACION_HABILITADA', ENTORNO === 'desarrollo'),
      false,
    ),
    SEMBRAR_SI_VACIA: intentar(() => booleano(e, 'SEMBRAR_SI_VACIA', false), false),
  };

  if (errores.length > 0) {
    throw new Error(
      `La API no puede arrancar porque la configuración tiene problemas:\n  - ${errores.join('\n  - ')}\n` +
        'Revisá el archivo .env (hay un ejemplo comentado en .env.example).',
    );
  }
  return entorno;
}
