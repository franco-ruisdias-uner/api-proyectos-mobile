// Lectura y validación de las variables de entorno. Función pura: recibe el entorno y
// devuelve la configuración tipada, o tira un ErrorDeConfiguracion con todo lo que falta
// explicado en castellano. Si la configuración está mal, la API no arranca.

export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
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
export type NombreEntorno = (typeof ENTORNOS)[number];

export type ModoNotificaciones = 'expo' | 'registro';

export interface Configuracion {
  puerto: number;
  entorno: NombreEntorno;
  confiarProxy: boolean;
  urlPublica: string | null;
  db: {
    motor: MotorDb;
    url: string | null;
    archivo: string;
    sincronizar: boolean;
  };
  jwtSecreto: string;
  archivos: {
    proveedor: ProveedorArchivos;
    directorio: string;
  };
  notificaciones: ModoNotificaciones;
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
  const motor = entre('DB_MOTOR', MOTORES, 'better-sqlite3');

  const url = env.DB_URL ?? null;
  if (motor !== 'better-sqlite3') {
    if (url === null) {
      problemas.push(
        `Falta DB_URL: con DB_MOTOR=${motor} hay que decir cómo conectarse, por ejemplo ` +
          (motor === 'postgres'
            ? 'postgres://usuario:contraseña@localhost:5432/api'
            : 'mysql://usuario:contraseña@localhost:3306/api') +
          '.',
      );
    } else {
      let protocolo = '';
      try {
        protocolo = new URL(url).protocol;
      } catch {
        problemas.push('DB_URL no es una dirección válida.');
      }
      const esperado = motor === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:', 'mariadb:'];
      if (protocolo && !esperado.includes(protocolo)) {
        problemas.push(
          `DB_URL empieza con "${protocolo}//", pero con DB_MOTOR=${motor} tiene que empezar con "${esperado[0]}//".`,
        );
      }
    }
  }

  const jwtSecreto = env.JWT_SECRETO ?? '';
  if (jwtSecreto === '') {
    problemas.push(
      'Falta JWT_SECRETO: es la clave con la que se firman las sesiones. ' +
        'Para desarrollo alcanza con el valor de .env.example.',
    );
  }

  const proveedor = entre('ARCHIVOS_PROVEEDOR', PROVEEDORES_ARCHIVOS, 'local');
  if (proveedor !== 'local') {
    problemas.push(
      `ARCHIVOS_PROVEEDOR=${proveedor} todavía no está disponible en esta versión de la API; por ahora usá "local".`,
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
    db: {
      motor,
      url,
      archivo: env.DB_ARCHIVO ?? 'datos/api.sqlite',
      sincronizar: booleano('DB_SINCRONIZAR', true),
    },
    jwtSecreto,
    archivos: {
      proveedor,
      directorio: env.DIRECTORIO_ARCHIVOS ?? './archivos',
    },
    notificaciones: entre('NOTIFICACIONES', ['expo', 'registro'] as const, 'expo'),
    relojFijo,
    simulacionHabilitada: booleano('SIMULACION_HABILITADA', entorno === 'desarrollo'),
    sembrarSiVacia: booleano('SEMBRAR_SI_VACIA', false),
  };

  if (problemas.length > 0) throw new ErrorDeConfiguracion(problemas);
  return configuracion;
}
