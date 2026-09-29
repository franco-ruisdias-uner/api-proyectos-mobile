// Variables de entorno: se validan al arrancar y, si algo falta o está mal, la API no arranca
// y dice en castellano qué arreglar (AGENTS §11.3).
import { parsearInstante } from '../comun/fechas/fechas.js';

export const MOTORES = [
  'better-sqlite3',
  'postgres',
  'mysql',
  'mariadb',
] as const;
export type Motor = (typeof MOTORES)[number];

export const ENTORNOS = ['desarrollo', 'test', 'publicado'] as const;
export const NOTIFICACIONES = ['expo', 'registro'] as const;

/** Proveedores de archivos del contrato (Salud.almacen). En M0 sólo está el disco. */
export const PROVEEDORES_ARCHIVOS = ['local'] as const;
export type ProveedorArchivos = (typeof PROVEEDORES_ARCHIVOS)[number];

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

  const DB_MOTOR = opcion('DB_MOTOR', MOTORES, 'better-sqlite3');
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

  const entorno: Entorno = {
    PUERTO,
    ENTORNO,
    CONFIAR_PROXY: booleano('CONFIAR_PROXY', false),
    URL_PUBLICA,
    DB_MOTOR,
    DB_URL,
    DB_ARCHIVO: texto('DB_ARCHIVO') ?? 'datos/api.sqlite',
    DB_SINCRONIZAR: booleano('DB_SINCRONIZAR', true),
    JWT_SECRETO,
    ARCHIVOS_PROVEEDOR: opcion(
      'ARCHIVOS_PROVEEDOR',
      PROVEEDORES_ARCHIVOS,
      'local',
    ),
    DIRECTORIO_ARCHIVOS: texto('DIRECTORIO_ARCHIVOS') ?? './archivos',
    NOTIFICACIONES: opcion('NOTIFICACIONES', NOTIFICACIONES, 'expo'),
    RELOJ_FIJO,
    SIMULACION_HABILITADA: booleano('SIMULACION_HABILITADA', true),
    SEMBRAR_SI_VACIA: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (problemas.length > 0) throw new ErrorDeConfiguracion(problemas);
  return entorno;
}
