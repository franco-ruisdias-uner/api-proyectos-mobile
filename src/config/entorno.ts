// Variables de entorno: se leen y se validan una sola vez, al arrancar.
// Si falta algo o está mal, la API no arranca y dice en castellano qué arreglar.

export const MOTORES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export type Motor = (typeof MOTORES)[number];

export const PROVEEDORES_ARCHIVOS = ['local'] as const;
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
  DB_ARCHIVO: string;
  DB_SINCRONIZAR: boolean;
  /** Sólo para tests: borra el esquema al conectar (base limpia por archivo). */
  DB_BORRAR_AL_CONECTAR: boolean;
  JWT_SECRETO: string;
  ARCHIVOS_PROVEEDOR: ProveedorArchivos;
  DIRECTORIO_ARCHIVOS: string;
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

  const DB_MOTOR = (texto(v, 'DB_MOTOR') ?? 'better-sqlite3') as Motor;
  if (!MOTORES.includes(DB_MOTOR)) {
    problemas.push(
      `DB_MOTOR tiene que ser uno de: ${MOTORES.join(', ')} (vino "${DB_MOTOR}"). ` +
        'Si usás XAMPP, poné "mariadb".',
    );
  }
  const DB_URL = texto(v, 'DB_URL') ?? null;
  if (DB_MOTOR !== 'better-sqlite3' && MOTORES.includes(DB_MOTOR)) {
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

  const JWT_SECRETO = texto(v, 'JWT_SECRETO');
  if (JWT_SECRETO === undefined) {
    problemas.push(
      'Falta JWT_SECRETO: es la clave con la que se firman las sesiones. ' +
        'Copiá .env.example a .env, que trae una de desarrollo.',
    );
  }

  const ARCHIVOS_PROVEEDOR = (texto(v, 'ARCHIVOS_PROVEEDOR') ??
    'local') as ProveedorArchivos;
  if (
    !(PROVEEDORES_ARCHIVOS as readonly string[]).includes(ARCHIVOS_PROVEEDOR)
  ) {
    problemas.push(
      `ARCHIVOS_PROVEEDOR="${ARCHIVOS_PROVEEDOR}" todavía no está disponible: por ahora sólo "local".`,
    );
  }

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

  const entorno: Entorno = {
    PUERTO,
    ENTORNO,
    CONFIAR_PROXY: booleano('CONFIAR_PROXY', false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_ARCHIVO: texto(v, 'DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR: booleano('DB_SINCRONIZAR', true),
    DB_BORRAR_AL_CONECTAR: booleano('DB_BORRAR_AL_CONECTAR', false),
    JWT_SECRETO: JWT_SECRETO ?? '',
    ARCHIVOS_PROVEEDOR,
    DIRECTORIO_ARCHIVOS: texto(v, 'DIRECTORIO_ARCHIVOS') ?? './archivos',
    NOTIFICACIONES,
    EXPO_PUSH_URL,
    RELOJ_FIJO,
    SIMULACION_HABILITADA: booleano(
      'SIMULACION_HABILITADA',
      ENTORNO === 'desarrollo',
    ),
    SEMBRAR_SI_VACIA: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (problemas.length > 0) {
    throw new Error(
      'La API no puede arrancar porque hay problemas con la configuración (archivo .env):\n' +
        problemas.map((p) => `  - ${p}`).join('\n'),
    );
  }
  return entorno;
}
