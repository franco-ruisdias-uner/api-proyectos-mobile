// Variables de entorno: se validan al arrancar y, si algo falta o está mal, la API no arranca
// y dice en castellano qué arreglar (AGENTS §11.3).
import { parsearInstante } from '../comun/fechas/fechas.js';
import {
  configuracionS3,
  PROVEEDORES_ARCHIVOS,
  type ConfiguracionS3,
  type ProveedorArchivos,
} from '../comun/archivos/proveedores.js';
import {
  configuracionBase,
  type ConfiguracionBase,
} from '../comun/db/proveedores.js';

export const MOTORES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export type Motor = (typeof MOTORES)[number];

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;
export const NOTIFICACIONES = ['expo', 'registro'] as const;

export { PROVEEDORES_ARCHIVOS, type ProveedorArchivos };

/** Secreto de desarrollo de .env.example y de los compose: no vale para publicar. */
const SECRETO_DE_DESARROLLO = 'solo-para-desarrollo-no-usar-en-produccion';

export interface Entorno {
  PUERTO: number;
  ENTORNO: (typeof ENTORNOS)[number];
  CONFIAR_PROXY: boolean;
  URL_PUBLICA: string | null;
  DB_MOTOR: Motor;
  DB_URL: string | null;
  DB_ARCHIVO: string;
  DB_SINCRONIZAR: boolean;
  JWT_SECRETO: string;
  ARCHIVOS_PROVEEDOR: ProveedorArchivos;
  DIRECTORIO_ARCHIVOS: string;
  /** Sólo con un proveedor S3: la configuración ya resuelta. */
  S3: ConfiguracionS3 | null;
  ARCHIVOS_REDIRIGIR: boolean;
  /** Base de datos: proveedor, esquema y SSL ya resueltos. */
  BASE: ConfiguracionBase;
  NOTIFICACIONES: (typeof NOTIFICACIONES)[number];
  RELOJ_FIJO: Date | null;
  SIMULACION_HABILITADA: boolean;
  SEMBRAR_SI_VACIA: boolean;
}

/** Clave con la que el Entorno validado queda guardado en ConfigService. */
export const CLAVE_ENTORNO = '__entorno';

export class ErrorDeConfiguracion extends Error {
  constructor(problemas: string[]) {
    super(
      'La API no puede arrancar porque hay problemas en la configuración (.env):\n' +
        problemas.map((p) => `  • ${p}`).join('\n') +
        '\nMirá .env.example: tiene cada variable explicada.',
    );
    this.name = 'ErrorDeConfiguracion';
  }
}

type Crudo = Record<string, unknown>;

export function validarEntorno(crudo: Crudo): Entorno {
  const problemas: string[] = [];
  const texto = (nombre: string): string | undefined => {
    const v = crudo[nombre];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };
  const booleano = (nombre: string, porDefecto: boolean): boolean => {
    const v = texto(nombre);
    if (v === undefined) return porDefecto;
    const minus = v.toLowerCase();
    if (['true', '1', 'si', 'sí'].includes(minus)) return true;
    if (['false', '0', 'no'].includes(minus)) return false;
    problemas.push(`${nombre} tiene que ser true o false (vino "${v}").`);
    return porDefecto;
  };
  const opcion = <T extends string>(
    nombre: string,
    opciones: readonly T[],
    porDefecto: T,
  ): T => {
    const v = texto(nombre);
    if (v === undefined) return porDefecto;
    if ((opciones as readonly string[]).includes(v)) return v as T;
    problemas.push(
      `${nombre} tiene que ser uno de: ${opciones.join(', ')} (vino "${v}").`,
    );
    return porDefecto;
  };

  // Puerto: PUERTO manda; si no, PORT (lo inyectan Render y Koyeb).
  let PUERTO = 3000;
  const puertoTexto = texto('PUERTO') ?? texto('PORT');
  if (puertoTexto !== undefined) {
    const n = Number(puertoTexto);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      problemas.push(
        `PUERTO tiene que ser un número entre 1 y 65535 (vino "${puertoTexto}").`,
      );
    } else {
      PUERTO = n;
    }
  }

  const ENTORNO = opcion('ENTORNO', ENTORNOS, 'desarrollo');

  let URL_PUBLICA: string | null = null;
  const urlPublica = texto('URL_PUBLICA');
  if (urlPublica !== undefined) {
    try {
      const u = new URL(urlPublica);
      if (u.protocol !== 'http:' && u.protocol !== 'https:')
        throw new Error('protocolo');
      URL_PUBLICA = urlPublica.replace(/\/+$/, '');
    } catch {
      problemas.push(
        `URL_PUBLICA tiene que ser una dirección completa, como https://mi-api.onrender.com (vino "${urlPublica}"). Si no la necesitás, dejala vacía.`,
      );
    }
  }

  const JWT_SECRETO = texto('JWT_SECRETO') ?? '';
  if (JWT_SECRETO === '') {
    problemas.push(
      'Falta JWT_SECRETO: es el secreto con el que se firman las sesiones. Copiá el de .env.example.',
    );
  }

  const base = configuracionBase({
    DB_PROVEEDOR: texto('DB_PROVEEDOR'),
    DB_MOTOR: texto('DB_MOTOR'),
    DB_URL: texto('DB_URL'),
    DB_SSL: texto('DB_SSL'),
    DB_SSL_CA: texto('DB_SSL_CA'),
    DB_ESQUEMA: texto('DB_ESQUEMA'),
  });
  if (!base.ok) problemas.push(...base.problemas);
  const DB_MOTOR = opcion(
    'DB_MOTOR',
    MOTORES,
    base.ok ? base.config.motor : 'better-sqlite3',
  );
  const DB_URL = texto('DB_URL') ?? null;
  if (DB_MOTOR !== 'better-sqlite3' && DB_URL === null) {
    problemas.push(
      `Con DB_MOTOR=${DB_MOTOR} hace falta DB_URL con la dirección de la base (por ejemplo ${
        DB_MOTOR === 'postgres'
          ? 'postgres://usuario:clave@localhost:5432/api'
          : 'mysql://usuario:clave@localhost:3306/api'
      }).`,
    );
  }

  let RELOJ_FIJO: Date | null = null;
  const reloj = texto('RELOJ_FIJO');
  if (reloj !== undefined) {
    RELOJ_FIJO = parsearInstante(reloj);
    if (RELOJ_FIJO === null) {
      problemas.push(
        `RELOJ_FIJO tiene que ser un instante con zona, como 2026-09-14T10:00:00-03:00 (vino "${reloj}").`,
      );
    }
  }

  const ARCHIVOS_PROVEEDOR = opcion(
    'ARCHIVOS_PROVEEDOR',
    PROVEEDORES_ARCHIVOS,
    'local',
  );
  const ARCHIVOS_REDIRIGIR = booleano('ARCHIVOS_REDIRIGIR', false);
  let S3: ConfiguracionS3 | null = null;
  if (ARCHIVOS_PROVEEDOR !== 'local') {
    const vars: Record<string, string | undefined> = {};
    for (const k of [
      'ARCHIVOS_PROVEEDOR',
      'ARCHIVOS_CREAR_BUCKET',
      'S3_BUCKET',
      'S3_REGION',
      'S3_ENDPOINT',
      'S3_FORZAR_PATH_STYLE',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'SUPABASE_PROYECTO',
      'R2_CUENTA',
    ])
      vars[k] = texto(k);
    const s3 = configuracionS3(vars);
    if (s3.ok) S3 = s3.config;
    else problemas.push(...s3.problemas);
  } else if (ARCHIVOS_REDIRIGIR) {
    problemas.push(
      'ARCHIVOS_REDIRIGIR=true sólo sirve con un proveedor en la nube: con ARCHIVOS_PROVEEDOR=local los archivos los sirve la API.',
    );
  }

  const SIMULACION_HABILITADA = booleano(
    'SIMULACION_HABILITADA',
    ENTORNO !== 'publicado',
  );
  const DB_SINCRONIZAR = booleano('DB_SINCRONIZAR', true);

  if (ENTORNO === 'publicado') {
    if (DB_MOTOR === 'better-sqlite3')
      problemas.push(
        'Con ENTORNO=publicado la base no puede ser SQLite: el disco del host se borra en cada reinicio. Definí DB_PROVEEDOR (por ejemplo supabase) y DB_URL.',
      );
    if (ARCHIVOS_PROVEEDOR === 'local')
      problemas.push(
        'Con ENTORNO=publicado los archivos no pueden ser locales: el disco del host se borra en cada reinicio. Definí ARCHIVOS_PROVEEDOR (por ejemplo supabase).',
      );
    if (JWT_SECRETO === SECRETO_DE_DESARROLLO || JWT_SECRETO.length < 32)
      problemas.push(
        "Con ENTORNO=publicado JWT_SECRETO tiene que ser propio, secreto y de al menos 32 caracteres (no el de desarrollo). Generá uno con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    if (SIMULACION_HABILITADA)
      problemas.push(
        'Con ENTORNO=publicado SIMULACION_HABILITADA tiene que ser false: la simulación de fallas es sólo para desarrollo.',
      );
  }

  const entorno: Entorno = {
    PUERTO,
    ENTORNO,
    CONFIAR_PROXY: booleano('CONFIAR_PROXY', false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_ARCHIVO: texto('DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR,
    JWT_SECRETO,
    ARCHIVOS_PROVEEDOR,
    DIRECTORIO_ARCHIVOS: texto('DIRECTORIO_ARCHIVOS') ?? './archivos',
    S3,
    ARCHIVOS_REDIRIGIR,
    BASE: base.ok
      ? base.config
      : {
          proveedor: null,
          motor: DB_MOTOR,
          esquema: null,
          ssl: 'no',
          sslCa: null,
          conexion: null,
        },
    NOTIFICACIONES: opcion('NOTIFICACIONES', NOTIFICACIONES, 'expo'),
    RELOJ_FIJO,
    SIMULACION_HABILITADA,
    SEMBRAR_SI_VACIA: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (problemas.length > 0) throw new ErrorDeConfiguracion(problemas);
  return entorno;
}
