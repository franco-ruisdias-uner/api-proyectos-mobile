// Lectura y validación de las variables de entorno. Función pura: recibe el entorno y
// devuelve la configuración tipada, o tira un ErrorDeConfiguracion con todo lo que falta
// explicado en castellano. Si la configuración está mal, la API no arranca.

import { esProveedorS3, type ConfiguracionS3, configuracionS3 } from '../common/files/providers.js';
import {
  configuracionBase,
  type ConfiguracionBase,
  MOTORES,
  type MotorDb,
} from '../common/db/providers.js';

export { MOTORES };
export type { MotorDb };

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
export type NombreEntorno = (typeof ENTORNOS)[number];

export type ModoNotificaciones = 'expo' | 'registro';

export interface Configuracion {
  puerto: number;
  entorno: NombreEntorno;
  confiarProxy: boolean;
  urlPublica: string | null;
  db: ConfiguracionBase;
  jwtSecreto: string;
  archivos: {
    proveedor: ProveedorArchivos;
    directorio: string;
    /** Sólo con un proveedor S3 (AGENTS §17.2). */
    s3: ConfiguracionS3 | null;
    /** 302 a una URL firmada en vez de pasar el archivo por la API (AGENTS §17.1). */
    redirigir: boolean;
  };
  notificaciones: ModoNotificaciones;
  /** Dirección de la API de push de Expo (AGENTS §19.2); los tests apuntan a un servidor falso. */
  expoPushUrl: string;
  relojFijo: Date | null;
  simulacionHabilitada: boolean;
  sembrarSiVacia: boolean;
}

export const CONFIGURACION = Symbol('CONFIGURACION');

export class ErrorDeConfiguracion extends Error {
  constructor(readonly problemas: string[]) {
    super(
      'La API no puede arrancar porque la configuración tiene problemas:\n' +
        problemas.map((p) => `  - ${p}`).join('\n') +
        '\nRevisá el archivo .env (podés copiar .env.example como punto de partida).',
    );
    this.name = 'ErrorDeConfiguracion';
  }
}

type Entorno = Record<string, string | undefined>;

const INSTANTE_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function leerConfiguracion(entrada: Record<string, unknown>): Configuracion {
  const env: Entorno = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (typeof valor === 'string' && valor.trim() !== '') env[clave] = valor.trim();
  }
  const problemas: string[] = [];

  const booleano = (nombre: string, porDefecto: boolean): boolean => {
    const valor = env[nombre];
    if (valor === undefined) return porDefecto;
    if (valor === 'true') return true;
    if (valor === 'false') return false;
    problemas.push(`${nombre} tiene que ser "true" o "false" (vale "${valor}").`);
    return porDefecto;
  };

  const entre = <T extends string>(nombre: string, opciones: readonly T[], porDefecto: T): T => {
    const valor = env[nombre];
    if (valor === undefined) return porDefecto;
    if ((opciones as readonly string[]).includes(valor)) return valor as T;
    problemas.push(`${nombre} vale "${valor}", pero tiene que ser uno de: ${opciones.join(', ')}.`);
    return porDefecto;
  };

  // Puerto: PUERTO, o PORT (lo inyectan Render y Koyeb), o 3000.
  let puerto = 3000;
  const textoPuerto = env.PUERTO ?? env.PORT;
  if (textoPuerto !== undefined) {
    const numero = Number(textoPuerto);
    if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
      problemas.push(`PUERTO tiene que ser un número entre 1 y 65535 (vale "${textoPuerto}").`);
    } else {
      puerto = numero;
    }
  }

  const entorno = entre('ENTORNO', ENTORNOS, 'desarrollo');

  const base = configuracionBase(env);
  if (!base.ok) problemas.push(...base.problemas);

  const jwtSecreto = env.JWT_SECRETO ?? '';
  if (jwtSecreto === '') {
    problemas.push(
      'Falta JWT_SECRETO: es la clave con la que se firman las sesiones. ' +
        'Para desarrollo alcanza con el valor de .env.example.',
    );
  }

  const proveedor = entre('ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local');
  let s3: ConfiguracionS3 | null = null;
  if (esProveedorS3(proveedor)) {
    const resultado = configuracionS3(proveedor, env);
    if (resultado.ok) s3 = resultado.config;
    else problemas.push(...resultado.problemas);
  }
  const redirigir = booleano('ARCHIVOS_REDIRIGIR', false);
  if (redirigir && proveedor === 'local') {
    problemas.push(
      'ARCHIVOS_REDIRIGIR=true sólo sirve con un proveedor en la nube (ARCHIVOS_PROVEEDOR distinto de "local").',
    );
  }

  let relojFijo: Date | null = null;
  if (env.RELOJ_FIJO !== undefined) {
    const instante = new Date(env.RELOJ_FIJO);
    if (!INSTANTE_CON_ZONA.test(env.RELOJ_FIJO) || Number.isNaN(instante.getTime())) {
      problemas.push(
        `RELOJ_FIJO tiene que ser una fecha y hora con zona, por ejemplo 2026-11-14T22:00:00-03:00 (vale "${env.RELOJ_FIJO}").`,
      );
    } else {
      relojFijo = instante;
    }
  }

  let urlPublica: string | null = null;
  if (env.URL_PUBLICA !== undefined) {
    try {
      const u = new URL(env.URL_PUBLICA);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
      urlPublica = env.URL_PUBLICA.replace(/\/+$/, '');
    } catch {
      problemas.push(
        `URL_PUBLICA tiene que ser una dirección http o https, por ejemplo https://mi-api.onrender.com (vale "${env.URL_PUBLICA}").`,
      );
    }
  }

  const configuracion: Configuracion = {
    puerto,
    entorno,
    confiarProxy: booleano('CONFIAR_PROXY', false),
    urlPublica,
    db: base.ok ? base.config : ({} as ConfiguracionBase),
    jwtSecreto,
    archivos: {
      proveedor,
      directorio: env.DIRECTORIO_ARCHIVOS ?? './archivos',
      s3,
      redirigir,
    },
    notificaciones: entre('NOTIFICACIONES', ['expo', 'registro'] as const, 'expo'),
    expoPushUrl: env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send',
    relojFijo,
    simulacionHabilitada: booleano('SIMULACION_HABILITADA', entorno === 'desarrollo'),
    sembrarSiVacia: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (entorno === 'publicado') problemas.push(...problemasDePublicacion(configuracion));
  if (problemas.length > 0) throw new ErrorDeConfiguracion(problemas);
  return configuracion;
}

export const JWT_SECRETO_DE_DESARROLLO = 'solo-para-desarrollo-no-usar-en-produccion';

/** ENTORNO=publicado: lo que no puede estar así en una API que corre en un host (AGENTS §18.2). */
function problemasDePublicacion(c: Configuracion): string[] {
  const problemas: string[] = [];
  if (c.db.motor === 'better-sqlite3') {
    problemas.push(
      'ENTORNO=publicado no se puede usar con SQLite: el disco del host se borra en cada reinicio. ' +
        'Usá una base administrada: DB_PROVEEDOR=supabase (o neon, aiven-postgres, aiven-mysql) y su DB_URL.',
    );
  }
  if (c.archivos.proveedor === 'local') {
    problemas.push(
      'ENTORNO=publicado no se puede usar con ARCHIVOS_PROVEEDOR=local: el disco del host se borra en cada reinicio. ' +
        'Usá ARCHIVOS_PROVEEDOR=supabase (o aws, r2, b2) y sus variables.',
    );
  }
  if (c.jwtSecreto === JWT_SECRETO_DE_DESARROLLO || c.jwtSecreto.includes('desarrollo')) {
    problemas.push(
      'ENTORNO=publicado no se puede usar con el JWT_SECRETO de desarrollo. Generá uno propio: ' +
        "node -e \"console.log(require('node:crypto').randomBytes(48).toString('base64url'))\"",
    );
  } else if (c.jwtSecreto.length < 32) {
    problemas.push('JWT_SECRETO tiene que tener al menos 32 caracteres cuando ENTORNO=publicado.');
  }
  if (c.simulacionHabilitada) {
    problemas.push(
      'ENTORNO=publicado no admite SIMULACION_HABILITADA=true: cualquiera podría tirar la API.',
    );
  }
  return problemas;
}
