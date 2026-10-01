// Presets de bases de datos administradas en la nube (AGENTS §18.1). Una tabla de datos y una
// función pura: recibe el entorno y devuelve cómo conectarse, o todo lo que está mal en
// castellano. Sin DB_PROVEEDOR, todo sigue como en AGENTS §5.1.

export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
export type MotorDb = (typeof MOTORES)[number];

export const PROVEEDORES_DB = ['supabase', 'neon', 'aiven-postgres', 'aiven-mysql'] as const;
export type ProveedorDb = (typeof PROVEEDORES_DB)[number];

export const MODOS_SSL = ['no', 'si', 'si-sin-verificar'] as const;
export type ModoSsl = (typeof MODOS_SSL)[number];

export interface ConexionDeServidor {
  host: string;
  puerto: number | undefined;
  usuario: string;
  contrasena: string;
  base: string;
}

export interface ConfiguracionBase {
  proveedor: ProveedorDb | null;
  motor: MotorDb;
  url: string | null;
  archivo: string;
  sincronizar: boolean;
  ssl: ModoSsl;
  /** Ruta al certificado de la CA del proveedor. */
  sslCa: string | null;
  /** Esquema de PostgreSQL donde van las tablas; `null` = el de la conexión. */
  esquema: string | null;
}

export type ResultadoBase =
  { ok: true; config: ConfiguracionBase } | { ok: false; problemas: string[] };

type Entorno = Record<string, string | undefined>;

interface Preset {
  motor: MotorDb;
  ssl: ModoSsl;
  esquema: string | null;
  /** Dónde se consigue la cadena de conexión, para los mensajes. */
  nombre: string;
  /** Devuelve los problemas de una DB_URL ya parseada. */
  validar(url: URL, usuario: string): string[];
}

export const PRESETS_DB: Record<ProveedorDb, Preset> = {
  supabase: {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'api',
    nombre: 'Supabase',
    validar(url, usuario) {
      const problemas: string[] = [];
      const queCopiar =
        'En el panel de Supabase, botón «Connect», copiá la cadena «Session pooler» (puerto 5432).';
      if (/^db\.[^.]+\.supabase\.co$/.test(url.hostname)) {
        problemas.push(
          'DB_URL es la conexión directa de Supabase, que sólo funciona por IPv6 y casi ningún host la alcanza. ' +
            queCopiar,
        );
      } else if (!url.hostname.endsWith('.pooler.supabase.com')) {
        problemas.push(
          `DB_URL no parece de Supabase: el servidor tendría que terminar en «.pooler.supabase.com» (dice «${url.hostname}»). ` +
            queCopiar,
        );
      } else if (url.port === '6543') {
        problemas.push(
          'DB_URL usa el pooler en modo transacción (puerto 6543), que no admite lo que necesita la API. ' +
            'Usá el pooler en modo sesión: el mismo servidor, con el puerto 5432.',
        );
      } else if (url.port !== '' && url.port !== '5432') {
        problemas.push(`DB_URL tiene el puerto ${url.port}: el pooler en modo sesión usa el 5432.`);
      }
      if (!usuario.startsWith('postgres.')) {
        problemas.push(
          `El usuario de DB_URL tiene que ser «postgres.<id del proyecto>» (dice «${usuario}»). ${queCopiar}`,
        );
      }
      return problemas;
    },
  },
  neon: {
    motor: 'postgres',
    ssl: 'si',
    esquema: 'public',
    nombre: 'Neon',
    validar: (url) =>
      url.hostname.endsWith('.neon.tech')
        ? []
        : [
            `DB_URL no parece de Neon: el servidor tendría que terminar en «.neon.tech» (dice «${url.hostname}»). ` +
              'Copiala del panel de Neon, en «Connect».',
          ],
  },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
    nombre: 'Aiven',
    validar: (url) => validarAiven(url),
  },
  'aiven-mysql': {
    motor: 'mysql',
    ssl: 'si-sin-verificar',
    esquema: null,
    nombre: 'Aiven',
    validar: (url) => validarAiven(url),
  },
};

function validarAiven(url: URL): string[] {
  return url.hostname.endsWith('.aivencloud.com')
    ? []
    : [
        `DB_URL no parece de Aiven: el servidor tendría que terminar en «.aivencloud.com» (dice «${url.hostname}»). ` +
          'Copiala del panel de Aiven, en «Connection information».',
      ];
}

const IDENTIFICADOR = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/** `DB_URL` → partes, decodificando lo que venga con %. Nunca con una expresión regular. */
export function conexionDeUrl(texto: string): ConexionDeServidor {
  const url = new URL(texto);
  return {
    host: url.hostname,
    puerto: url.port === '' ? undefined : Number(url.port),
    usuario: decodeURIComponent(url.username),
    contrasena: decodeURIComponent(url.password),
    base: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
}

export function configuracionBase(entrada: Entorno): ResultadoBase {
  const env: Entorno = {};
  for (const [nombre, valor] of Object.entries(entrada)) {
    const v = valor?.trim();
    if (v) env[nombre] = v;
  }
  const problemas: string[] = [];

  const entre = <T extends string>(nombre: string, opciones: readonly T[]): T | undefined => {
    const valor = env[nombre];
    if (valor === undefined) return undefined;
    if ((opciones as readonly string[]).includes(valor)) return valor as T;
    problemas.push(`${nombre} vale "${valor}", pero tiene que ser uno de: ${opciones.join(', ')}.`);
    return undefined;
  };

  const proveedor = entre('DB_PROVEEDOR', PROVEEDORES_DB) ?? null;
  const preset = proveedor ? PRESETS_DB[proveedor] : null;
  const motorPedido = entre('DB_MOTOR', MOTORES);
  if (preset && motorPedido && motorPedido !== preset.motor) {
    problemas.push(
      `DB_PROVEEDOR=${proveedor} es una base ${preset.motor}, pero DB_MOTOR dice ${motorPedido}. ` +
        'Borrá DB_MOTOR o ponelo igual.',
    );
  }
  const motor: MotorDb = preset?.motor ?? motorPedido ?? 'better-sqlite3';

  const url = env.DB_URL ?? null;
  if (motor !== 'better-sqlite3') {
    if (url === null) {
      problemas.push(
        preset
          ? `Falta DB_URL: es la cadena de conexión de tu base en ${preset.nombre}.`
          : `Falta DB_URL: con DB_MOTOR=${motor} hay que decir cómo conectarse, por ejemplo ` +
              (motor === 'postgres'
                ? 'postgres://usuario:contraseña@localhost:5432/api'
                : 'mysql://usuario:contraseña@localhost:3306/api') +
              '.',
      );
    } else {
      let analizada: URL | null = null;
      try {
        analizada = new URL(url);
      } catch {
        problemas.push('DB_URL no es una dirección válida.');
      }
      if (analizada) {
        const esperado =
          motor === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:', 'mariadb:'];
        if (!esperado.includes(analizada.protocol)) {
          problemas.push(
            `DB_URL empieza con "${analizada.protocol}//", pero con ${preset ? `DB_PROVEEDOR=${proveedor}` : `DB_MOTOR=${motor}`} tiene que empezar con "${esperado[0]}//".`,
          );
        } else if (preset) {
          problemas.push(...preset.validar(analizada, decodeURIComponent(analizada.username)));
        }
      }
    }
  }

  const sslPedido = entre('DB_SSL', MODOS_SSL);
  const sslCa = env.DB_SSL_CA ?? null;
  let ssl: ModoSsl = sslPedido ?? preset?.ssl ?? 'no';
  // Con la CA del proveedor se puede verificar el certificado.
  if (sslPedido === undefined && ssl === 'si-sin-verificar' && sslCa) ssl = 'si';

  let esquema = env.DB_ESQUEMA ?? preset?.esquema ?? null;
  if (env.DB_ESQUEMA !== undefined) {
    if (motor !== 'postgres') {
      problemas.push('DB_ESQUEMA sólo se usa con PostgreSQL.');
      esquema = null;
    } else if (!IDENTIFICADOR.test(env.DB_ESQUEMA)) {
      problemas.push(
        `DB_ESQUEMA vale "${env.DB_ESQUEMA}": tiene que ser un nombre simple, con letras, números y guion bajo (por ejemplo api).`,
      );
    }
  }
  if (motor !== 'postgres') esquema = null;

  const sincronizar = env.DB_SINCRONIZAR;
  if (sincronizar !== undefined && sincronizar !== 'true' && sincronizar !== 'false') {
    problemas.push(`DB_SINCRONIZAR tiene que ser "true" o "false" (vale "${sincronizar}").`);
  }

  if (problemas.length > 0) return { ok: false, problemas };
  return {
    ok: true,
    config: {
      proveedor,
      motor,
      url,
      archivo: env.DB_ARCHIVO ?? 'datos/api.sqlite',
      sincronizar: sincronizar !== 'false',
      ssl,
      sslCa,
      esquema,
    },
  };
}
