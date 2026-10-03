import { parsearInstante } from '../comun/fechas/fechas.js';

export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
export type Motor = (typeof MOTORES)[number];

/** Por ahora sólo disco; los proveedores compatibles con S3 llegan con el módulo «Nube». */
export const PROVEEDORES_ARCHIVOS = ['local'] as const;
export type ProveedorArchivosConfigurado = (typeof PROVEEDORES_ARCHIVOS)[number];

export const MODOS_NOTIFICACIONES = ['expo', 'registro'] as const;
export type ModoNotificaciones = (typeof MODOS_NOTIFICACIONES)[number];

export const ENTORNOS = ['desarrollo', 'test'] as const;
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
  jwtSecreto: string;
  archivosProveedor: ProveedorArchivosConfigurado;
  directorioArchivos: string;
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
  const dbMotor = opcion('DB_MOTOR', MOTORES, 'better-sqlite3');
  const dbUrl = url('DB_URL');
  if (dbMotor !== 'better-sqlite3' && dbUrl === null && texto('DB_URL') === undefined) {
    problemas.push(
      `Falta DB_URL: con DB_MOTOR=${dbMotor} hace falta la dirección de la base, por ejemplo ` +
        (dbMotor === 'postgres'
          ? 'postgres://usuario:clave@localhost:5432/api'
          : 'mysql://usuario:clave@localhost:3306/api') +
        '. Mirá .env.example.',
    );
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
    jwtSecreto: jwtSecreto ?? '',
    archivosProveedor: opcion('ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local'),
    directorioArchivos: texto('DIRECTORIO_ARCHIVOS') ?? './archivos',
    notificaciones: opcion('NOTIFICACIONES', MODOS_NOTIFICACIONES, 'expo'),
    expoPushUrl: url('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send',
    relojFijo,
    simulacionHabilitada: booleano('SIMULACION_HABILITADA', entorno !== 'test'),
    sembrarSiVacia: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (problemas.length > 0) {
    throw new Error(
      'La API no puede arrancar porque la configuración tiene problemas:\n' +
        problemas.map((p) => `  - ${p}`).join('\n'),
    );
  }
  return resultado;
}
