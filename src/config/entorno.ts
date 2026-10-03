import {
  configuracionS3,
  type ConfiguracionS3,
  PROVEEDORES_ARCHIVOS,
  type ProveedorArchivosConfigurado,
} from '../comun/archivos/proveedores.js';
import {
  configuracionBase,
  type ModoSsl,
  type Motor,
  type ProveedorDb,
} from '../comun/db/proveedores.js';
import { parsearInstante } from '../comun/fechas/fechas.js';

export { MOTORES, type Motor } from '../comun/db/proveedores.js';
export { PROVEEDORES_ARCHIVOS, type ProveedorArchivosConfigurado };

/** El secreto de los .env.example y los compose: sirve para desarrollar, no para publicar. */
const SECRETOS_DE_DESARROLLO = ['solo-para-desarrollo-no-usar-en-produccion'];

export const MODOS_NOTIFICACIONES = ['expo', 'registro'] as const;
export type ModoNotificaciones = (typeof MODOS_NOTIFICACIONES)[number];

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;
export type NombreEntorno = (typeof ENTORNOS)[number];

/** La configuración ya validada y con sus defaults. Se inyecta con el token `ENTORNO`. */
export interface Entorno {
  puerto: number;
  entorno: NombreEntorno;
  confiarProxy: boolean;
  urlPublica: string | null;
  dbMotor: Motor;
  dbUrl: string | null;
  dbArchivo: string;
  dbSincronizar: boolean;
  dbProveedor: ProveedorDb | null;
  dbSsl: ModoSsl;
  /** Ruta al certificado de la CA del proveedor. */
  dbSslCa: string | null;
  /** Esquema de PostgreSQL donde van las tablas (null: el de la conexión). */
  dbEsquema: string | null;
  jwtSecreto: string;
  archivosProveedor: ProveedorArchivosConfigurado;
  directorioArchivos: string;
  /** Configuración del cliente S3; null con `ARCHIVOS_PROVEEDOR=local`. */
  s3: ConfiguracionS3 | null;
  archivosRedirigir: boolean;
  notificaciones: ModoNotificaciones;
  expoPushUrl: string;
  relojFijo: Date | null;
  simulacionHabilitada: boolean;
  sembrarSiVacia: boolean;
}

export const ENTORNO = Symbol('ENTORNO');

type Variables = Record<string, unknown>;

/**
 * Valida las variables de entorno. Si algo falta o está mal, tira un error que dice en
 * castellano qué variable es y cómo arreglarla (la API no arranca).
 */
export function validarEntorno(variables: Variables): Entorno {
  const problemas: string[] = [];
  const texto = (nombre: string): string | undefined => {
    const v = variables[nombre];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };

  const opcion = <T extends string>(nombre: string, validas: readonly T[], porDefecto: T): T => {
    const v = texto(nombre);
    if (v === undefined) return porDefecto;
    if ((validas as readonly string[]).includes(v)) return v as T;
    problemas.push(`${nombre} vale "${v}", pero tiene que ser uno de: ${validas.join(', ')}.`);
    return porDefecto;
  };

  const booleano = (nombre: string, porDefecto: boolean): boolean => {
    const v = texto(nombre);
    if (v === undefined) return porDefecto;
    if (v === 'true') return true;
    if (v === 'false') return false;
    problemas.push(`${nombre} vale "${v}", pero tiene que ser "true" o "false".`);
    return porDefecto;
  };

  const url = (nombre: string): string | null => {
    const v = texto(nombre);
    if (v === undefined) return null;
    try {
      new URL(v);
      return v;
    } catch {
      problemas.push(
        `${nombre} vale "${v}", que no es una dirección válida (por ejemplo, http://192.168.0.10:3000).`,
      );
      return null;
    }
  };

  let puerto = 3000;
  const puertoTexto = texto('PUERTO') ?? texto('PORT');
  if (puertoTexto !== undefined) {
    const n = Number(puertoTexto);
    if (Number.isInteger(n) && n > 0 && n < 65536) puerto = n;
    else
      problemas.push(
        `PUERTO vale "${puertoTexto}", pero tiene que ser un número de puerto (por ejemplo, 3000).`,
      );
  }

  const entorno = opcion('ENTORNO', ENTORNOS, 'desarrollo');
  const base = configuracionBase(variables);
  if ('errores' in base) problemas.push(...base.errores);
  const dbMotor: Motor = 'config' in base ? base.config.motor : 'better-sqlite3';
  const dbUrl = 'config' in base ? base.config.url : null;

  const archivosProveedor = opcion('ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local');
  let s3: ConfiguracionS3 | null = null;
  if (archivosProveedor !== 'local') {
    const r = configuracionS3(variables);
    if ('errores' in r) problemas.push(...r.errores);
    else s3 = r.config;
  }

  const jwtSecreto = texto('JWT_SECRETO');
  if (jwtSecreto === undefined) {
    problemas.push(
      'Falta JWT_SECRETO: es la clave con la que se firman las sesiones. Copiá .env.example a .env, que trae una de desarrollo.',
    );
  }

  let relojFijo: Date | null = null;
  const relojTexto = texto('RELOJ_FIJO');
  if (relojTexto !== undefined) {
    relojFijo = parsearInstante(relojTexto);
    if (!relojFijo) {
      problemas.push(
        `RELOJ_FIJO vale "${relojTexto}", pero tiene que ser un instante con zona, por ejemplo 2026-11-14T21:00:00-03:00.`,
      );
    }
  }

  const resultado: Entorno = {
    puerto,
    entorno,
    confiarProxy: booleano('CONFIAR_PROXY', false),
    urlPublica: url('URL_PUBLICA')?.replace(/\/+$/, '') ?? null,
    dbMotor,
    dbUrl,
    dbArchivo: texto('DB_ARCHIVO') ?? 'datos/api.sqlite',
    dbSincronizar: booleano('DB_SINCRONIZAR', true),
    dbProveedor: 'config' in base ? base.config.proveedor : null,
    dbSsl: 'config' in base ? base.config.ssl : 'no',
    dbSslCa: 'config' in base ? base.config.sslCa : null,
    dbEsquema: 'config' in base ? base.config.esquema : null,
    jwtSecreto: jwtSecreto ?? '',
    archivosProveedor,
    directorioArchivos: texto('DIRECTORIO_ARCHIVOS') ?? './archivos',
    s3,
    archivosRedirigir: booleano('ARCHIVOS_REDIRIGIR', false),
    notificaciones: opcion('NOTIFICACIONES', MODOS_NOTIFICACIONES, 'expo'),
    expoPushUrl: url('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send',
    relojFijo,
    simulacionHabilitada: booleano('SIMULACION_HABILITADA', entorno === 'desarrollo'),
    sembrarSiVacia: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (entorno === 'publicado') problemas.push(...problemasDePublicacion(resultado));

  if (problemas.length > 0) {
    throw new Error(
      'La API no puede arrancar porque la configuración tiene problemas:\n' +
        problemas.map((p) => `  - ${p}`).join('\n'),
    );
  }
  return resultado;
}

/** Lo que impide arrancar con `ENTORNO=publicado` (AGENTS §18.2). */
function problemasDePublicacion(e: Entorno): string[] {
  const p: string[] = [];
  if (e.dbMotor === 'better-sqlite3') {
    p.push(
      'ENTORNO=publicado no admite SQLite: el disco del host se borra en cada reinicio. Usá una base administrada (DB_PROVEEDOR=supabase, neon…) o PostgreSQL/MySQL con DB_URL.',
    );
  }
  if (e.archivosProveedor === 'local') {
    p.push(
      'ENTORNO=publicado no admite ARCHIVOS_PROVEEDOR=local: las fotos se perderían en cada reinicio. Usá supabase, r2, b2 o aws.',
    );
  }
  if (e.archivosProveedor === 's3proxy' || e.archivosProveedor === 'localstack') {
    p.push(
      `ENTORNO=publicado no admite ARCHIVOS_PROVEEDOR=${e.archivosProveedor}: es un emulador para tu computadora. Usá supabase, r2, b2 o aws.`,
    );
  }
  if (SECRETOS_DE_DESARROLLO.includes(e.jwtSecreto) || e.jwtSecreto.length < 32) {
    p.push(
      "ENTORNO=publicado pide un JWT_SECRETO propio de al menos 32 caracteres (no el de desarrollo). Generá uno con: node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  if (e.simulacionHabilitada) {
    p.push(
      'ENTORNO=publicado no admite SIMULACION_HABILITADA=true: poné SIMULACION_HABILITADA=false.',
    );
  }
  return p;
}
