// Configuración validada al arrancar (AGENTS §11.3). Si falta algo o está mal, la API
// no arranca y dice en castellano qué falta y cómo arreglarlo.
import {
  configuracionS3,
  type ConfiguracionS3,
} from '../common/files/providers.js';
import {
  configuracionBase,
  MODOS_SSL,
  type ModoSsl,
} from '../common/db/providers.js';
import { leerInstante } from '../common/dates/dates.js';

export const MOTORES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export type MotorDb = (typeof MOTORES)[number];

export const PROVEEDORES_ARCHIVOS = [
  'local',
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type ProveedorArchivos = (typeof PROVEEDORES_ARCHIVOS)[number];

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;
export type Entorno = (typeof ENTORNOS)[number];

export const JWT_SECRETO_DESARROLLO =
  'solo-para-desarrollo-no-usar-en-produccion';

/** Token de inyección y forma de la configuración ya validada. */
export abstract class Configuracion {
  abstract readonly entorno: Entorno;
  abstract readonly puerto: number;
  abstract readonly confiarProxy: boolean;
  abstract readonly urlPublica: string | null;
  abstract readonly db: {
    readonly motor: MotorDb;
    readonly url: string | null;
    readonly archivo: string;
    readonly sincronizar: boolean;
    /** Preset de base administrada (DB_PROVEEDOR), si hay. */
    readonly proveedor: string | null;
    readonly ssl: ModoSsl;
    readonly sslCa: string | null;
    /** Esquema de PostgreSQL donde van las tablas (null = el de la conexión). */
    readonly esquema: string | null;
  };
  abstract readonly jwtSecreto: string;
  abstract readonly archivos: {
    readonly proveedor: ProveedorArchivos;
    readonly directorio: string;
    /** Sólo con proveedores S3. */
    readonly s3: ConfiguracionS3 | null;
  };
  abstract readonly notificaciones: 'expo' | 'registro';
  abstract readonly expoPushUrl: string;
  abstract readonly relojFijo: string | null;
  abstract readonly simulacionHabilitada: boolean;
  abstract readonly sembrarSiVacia: boolean;
}

type EntornoCrudo = Record<string, string | undefined>;

export class ErrorDeConfiguracion extends Error {
  constructor(readonly problemas: string[]) {
    super(
      'La API no puede arrancar porque la configuración tiene problemas:\n' +
        problemas.map((p) => `  • ${p}`).join('\n') +
        '\nRevisá el archivo .env (copialo de .env.example si no lo tenés).',
    );
  }
}

/** Valida las variables de entorno y devuelve la configuración tipada. Función pura. */
export function validarEntorno(crudo: EntornoCrudo): Configuracion {
  const problemas: string[] = [];
  const texto = (nombre: string): string | null => {
    const v = crudo[nombre]?.trim();
    return v === undefined || v === '' ? null : v;
  };
  const booleano = (nombre: string, porDefecto: boolean): boolean => {
    const v = texto(nombre);
    if (v === null) return porDefecto;
    if (v === 'true') return true;
    if (v === 'false') return false;
    problemas.push(`${nombre} tiene que ser "true" o "false" (vino "${v}").`);
    return porDefecto;
  };
  const deLista = <T extends string>(
    nombre: string,
    opciones: readonly T[],
    porDefecto: T,
  ): T => {
    const v = texto(nombre);
    if (v === null) return porDefecto;
    if ((opciones as readonly string[]).includes(v)) return v as T;
    problemas.push(
      `${nombre} tiene que ser uno de: ${opciones.join(', ')} (vino "${v}").`,
    );
    return porDefecto;
  };

  const entorno = deLista('ENTORNO', ENTORNOS, 'desarrollo');

  const puertoTexto = texto('PUERTO') ?? texto('PORT') ?? '3000';
  const puerto = Number(puertoTexto);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    problemas.push(
      `PUERTO tiene que ser un número entre 1 y 65535 (vino "${puertoTexto}").`,
    );
  }

  let motor = deLista('DB_MOTOR', MOTORES, 'better-sqlite3');
  const dbUrl = texto('DB_URL');
  const base = configuracionBase(crudo);
  if (base !== null && 'error' in base) problemas.push(base.error);
  else if (base !== null) motor = base.motor;
  const baseOk = base !== null && !('error' in base) ? base : null;
  if (base === null && motor !== 'better-sqlite3' && dbUrl === null) {
    const ejemplo =
      motor === 'postgres'
        ? 'postgres://usuario:clave@localhost:5432/reservas'
        : 'mysql://usuario:clave@localhost:3306/reservas';
    problemas.push(
      `Con DB_MOTOR=${motor} falta DB_URL, la dirección de la base (por ejemplo ${ejemplo}).`,
    );
  }
  if (base === null && dbUrl !== null && motor !== 'better-sqlite3') {
    try {
      new URL(dbUrl);
    } catch {
      problemas.push(
        'DB_URL no es una dirección válida (tiene que empezar con postgres:// o mysql://).',
      );
    }
  }

  const jwtSecreto = texto('JWT_SECRETO');
  if (jwtSecreto === null) {
    problemas.push(
      'Falta JWT_SECRETO, la clave con la que se firman las sesiones. Para desarrollo copiá la de .env.example.',
    );
  }

  const proveedor = deLista(
    'ARCHIVOS_PROVEEDOR',
    PROVEEDORES_ARCHIVOS,
    'local',
  );
  let s3: ConfiguracionS3 | null = null;
  if (proveedor !== 'local') {
    const r = configuracionS3(proveedor, crudo);
    if ('error' in r) problemas.push(r.error);
    else s3 = r;
  }

  const urlPublica = texto('URL_PUBLICA');
  if (urlPublica !== null && !/^https?:\/\/[^\s/]+/.test(urlPublica)) {
    problemas.push(
      `URL_PUBLICA tiene que empezar con http:// o https:// (vino "${urlPublica}").`,
    );
  }

  const relojFijo = texto('RELOJ_FIJO');
  if (relojFijo !== null && leerInstante(relojFijo) === null) {
    problemas.push(
      `RELOJ_FIJO tiene que ser un instante con zona, como 2026-11-14T21:00:00-03:00 (vino "${relojFijo}").`,
    );
  }

  const configuracion: Configuracion = {
    entorno,
    puerto,
    confiarProxy: booleano('CONFIAR_PROXY', false),
    urlPublica: urlPublica?.replace(/\/+$/, '') ?? null,
    db: {
      motor,
      url: dbUrl,
      archivo: texto('DB_ARCHIVO') ?? 'datos/api.sqlite',
      sincronizar: booleano('DB_SINCRONIZAR', true),
      proveedor: texto('DB_PROVEEDOR'),
      ssl: baseOk?.ssl ?? deLista('DB_SSL', MODOS_SSL, 'no'),
      sslCa: texto('DB_SSL_CA'),
      esquema:
        baseOk?.esquema ?? (motor === 'postgres' ? texto('DB_ESQUEMA') : null),
    },
    jwtSecreto: jwtSecreto ?? '',
    archivos: {
      proveedor,
      directorio: texto('DIRECTORIO_ARCHIVOS') ?? './archivos',
      s3,
    },
    notificaciones: deLista(
      'NOTIFICACIONES',
      ['expo', 'registro'] as const,
      'registro',
    ),
    expoPushUrl:
      texto('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send',
    relojFijo,
    simulacionHabilitada: booleano(
      'SIMULACION_HABILITADA',
      entorno === 'desarrollo',
    ),
    sembrarSiVacia: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (entorno === 'publicado') {
    if (motor === 'better-sqlite3')
      problemas.push(
        'ENTORNO=publicado no admite SQLite: el disco del host se borra en cada reinicio. Usá una base administrada (DB_PROVEEDOR=supabase y DB_URL).',
      );
    if (proveedor === 'local')
      problemas.push(
        'ENTORNO=publicado no admite ARCHIVOS_PROVEEDOR=local: el disco del host se borra en cada reinicio. Usá supabase, r2, b2 o aws.',
      );
    if (
      jwtSecreto !== null &&
      (jwtSecreto === JWT_SECRETO_DESARROLLO || jwtSecreto.length < 32)
    )
      problemas.push(
        'ENTORNO=publicado pide un JWT_SECRETO propio de al menos 32 caracteres (no el de desarrollo).',
      );
    if (configuracion.simulacionHabilitada)
      problemas.push(
        'ENTORNO=publicado no admite SIMULACION_HABILITADA=true: ponelo en false.',
      );
  }

  if (problemas.length > 0) throw new ErrorDeConfiguracion(problemas);
  return configuracion;
}
