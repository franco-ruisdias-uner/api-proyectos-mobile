/**
 * Presets de base de datos administrada (AGENTS §18.1). Una variable, `DB_PROVEEDOR`, completa y
 * valida lo que cada servicio necesita. Todo acá es puro: no lee el entorno del proceso ni toca
 * la red, así se prueba con tablas de casos.
 */

export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
export type Motor = (typeof MOTORES)[number];

export const MODOS_SSL = ['no', 'si', 'si-sin-verificar'] as const;
export type ModoSsl = (typeof MODOS_SSL)[number];

type Crudo = Record<string, string | undefined>;

interface Preset {
  motor: Motor;
  ssl: ModoSsl;
  esquema: string | null;
  /** Devuelve el problema en castellano, o `null` si la URL es la que corresponde. */
  validarUrl(url: URL): string | null;
}

const AYUDA_SUPABASE =
  'En Supabase: botón «Connect» → «Session pooler» y copiá esa cadena (el puerto es 5432).';

/** La tabla de presets: agregar un proveedor es agregar una fila. */
export const PRESETS_BASE = {
  supabase: {
    motor: 'postgres',
    // Supabase firma con una CA propia: se cifra sin verificar, salvo que se pase DB_SSL_CA.
    ssl: 'si-sin-verificar',
    esquema: 'api',
    validarUrl(url) {
      if (/^db\..+\.supabase\.co$/.test(url.hostname)) {
        return (
          'Esa es la conexión directa de Supabase, que sólo funciona por IPv6 (Render y la mayoría de ' +
          `los servicios salen por IPv4). Usá el pooler compartido en modo sesión. ${AYUDA_SUPABASE}`
        );
      }
      if (!url.hostname.endsWith('.pooler.supabase.com')) {
        return `DB_URL no parece de Supabase: el servidor tendría que terminar en .pooler.supabase.com. ${AYUDA_SUPABASE}`;
      }
      if (url.port === '6543') {
        return (
          'Esa es la conexión del pooler en modo transacción (puerto 6543), que no admite las ' +
          `consultas que usa la API. Usá el modo sesión, puerto 5432. ${AYUDA_SUPABASE}`
        );
      }
      if (url.port !== '' && url.port !== '5432') {
        return `El puerto del pooler en modo sesión de Supabase es 5432 (DB_URL dice ${url.port}). ${AYUDA_SUPABASE}`;
      }
      if (!decodeURIComponent(url.username).startsWith('postgres.')) {
        return `En el pooler de Supabase el usuario es postgres.<código del proyecto>, no «${decodeURIComponent(url.username)}». ${AYUDA_SUPABASE}`;
      }
      return null;
    },
  },
  neon: {
    motor: 'postgres',
    ssl: 'si',
    esquema: 'public',
    validarUrl: (url) =>
      url.hostname.endsWith('.neon.tech')
        ? null
        : 'DB_URL no parece de Neon: el servidor tendría que terminar en .neon.tech. Copiala del panel de Neon, en «Connect».',
  },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
    validarUrl: (url) =>
      url.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el servidor tendría que terminar en .aivencloud.com. Copiala del panel del servicio, en «Service URI».',
  },
  'aiven-mysql': {
    motor: 'mysql',
    ssl: 'si-sin-verificar',
    esquema: null,
    validarUrl: (url) =>
      url.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el servidor tendría que terminar en .aivencloud.com. Copiala del panel del servicio, en «Service URI».',
  },
} as const satisfies Record<string, Preset>;

export type ProveedorBase = keyof typeof PRESETS_BASE;
export const PROVEEDORES_BASE = Object.keys(PRESETS_BASE) as ProveedorBase[];

export interface ConfiguracionBase {
  motor: Motor;
  proveedor: ProveedorBase | null;
  /** `null` sólo con SQLite. */
  url: string | null;
  ssl: ModoSsl;
  /** Ruta al certificado de la CA del proveedor (con `ssl: 'si'`), o `null`. */
  sslCa: string | null;
  /** Esquema de PostgreSQL donde van las tablas, o `null` para el de siempre. */
  esquema: string | null;
}

export type ResultadoBase = ConfiguracionBase | { error: string };

const texto = (e: Crudo, nombre: string): string | undefined => {
  const valor = e[nombre]?.trim();
  return valor === '' ? undefined : valor;
};

const EJEMPLO_URL: Record<Exclude<Motor, 'better-sqlite3'>, string> = {
  postgres: 'postgres://api:api@localhost:5432/api',
  mysql: 'mysql://api:api@localhost:3306/api',
  mariadb: 'mysql://api:api@localhost:3306/api',
};

const PROTOCOLOS: Record<Exclude<Motor, 'better-sqlite3'>, string[]> = {
  postgres: ['postgres:', 'postgresql:'],
  mysql: ['mysql:'],
  mariadb: ['mysql:', 'mariadb:'],
};

/** Valida y completa la configuración de base de datos a partir del entorno. */
export function configuracionBase(e: Crudo): ResultadoBase {
  const nombreProveedor = texto(e, 'DB_PROVEEDOR');
  if (nombreProveedor !== undefined && !(PROVEEDORES_BASE as string[]).includes(nombreProveedor)) {
    return {
      error: `DB_PROVEEDOR tiene que ser uno de: ${PROVEEDORES_BASE.join(', ')} (dice "${nombreProveedor}"). Si usás una base común, borrá esa variable.`,
    };
  }
  const proveedor = (nombreProveedor as ProveedorBase | undefined) ?? null;
  const preset: Preset | null = proveedor ? PRESETS_BASE[proveedor] : null;

  // Con un proveedor, el motor lo define el preset (pisa a DB_MOTOR).
  const motorPedido = texto(e, 'DB_MOTOR') ?? 'better-sqlite3';
  if (!(MOTORES as readonly string[]).includes(motorPedido)) {
    return { error: `DB_MOTOR tiene que ser uno de: ${MOTORES.join(', ')} (dice "${motorPedido}").` };
  }
  const motor = preset?.motor ?? (motorPedido as Motor);

  const modoPedido = texto(e, 'DB_SSL');
  if (modoPedido !== undefined && !(MODOS_SSL as readonly string[]).includes(modoPedido)) {
    return {
      error: `DB_SSL tiene que ser uno de: ${MODOS_SSL.join(', ')} (dice "${modoPedido}"). «si» cifra y verifica el certificado; «si-sin-verificar» cifra sin verificarlo.`,
    };
  }
  const sslCa = texto(e, 'DB_SSL_CA') ?? null;
  const ssl: ModoSsl = (modoPedido as ModoSsl | undefined) ?? (sslCa ? 'si' : (preset?.ssl ?? 'no'));

  const esquemaPedido = texto(e, 'DB_ESQUEMA');
  if (esquemaPedido !== undefined && !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(esquemaPedido)) {
    return {
      error: `DB_ESQUEMA tiene que ser un nombre simple: letras, números y guion bajo, sin espacios (dice "${esquemaPedido}").`,
    };
  }
  const esquema = motor === 'postgres' ? (esquemaPedido ?? preset?.esquema ?? null) : null;

  if (motor === 'better-sqlite3') {
    return { motor, proveedor, url: null, ssl: 'no', sslCa: null, esquema: null };
  }

  const url = texto(e, 'DB_URL');
  if (!url) {
    const ayuda = proveedor === 'supabase' ? ` ${AYUDA_SUPABASE}` : '';
    return {
      error: `Con ${proveedor ? `DB_PROVEEDOR=${proveedor}` : `DB_MOTOR=${motor}`} hace falta DB_URL (por ejemplo ${EJEMPLO_URL[motor]}).${ayuda}`,
    };
  }
  let analizada: URL;
  try {
    analizada = new URL(url);
  } catch {
    return {
      error:
        `DB_URL no es una dirección válida (tiene que ser como ${EJEMPLO_URL[motor]}). ` +
        'Si la contraseña tiene caracteres raros como @, / o #, escribilos como %40, %2F o %23.',
    };
  }
  if (!PROTOCOLOS[motor].includes(analizada.protocol)) {
    return {
      error: `Con ${motor} DB_URL tiene que empezar con ${PROTOCOLOS[motor][0]}// (dice "${analizada.protocol}//").`,
    };
  }
  const problema = preset?.validarUrl(analizada) ?? null;
  if (problema) return { error: problema };

  return { motor, proveedor, url, ssl, sslCa, esquema };
}

export interface ConexionRed {
  host: string;
  puerto: number;
  usuario: string;
  contrasena: string;
  base: string;
}

/** Descompone `DB_URL` con `URL` (nunca con una expresión regular) y decodifica sus partes. */
export function conexionDeUrl(url: string, motor: Exclude<Motor, 'better-sqlite3'>): ConexionRed {
  const analizada = new URL(url);
  const porDefecto = motor === 'postgres' ? 5432 : 3306;
  return {
    host: analizada.hostname.replace(/^\[|\]$/g, ''),
    puerto: analizada.port ? Number(analizada.port) : porDefecto,
    usuario: decodeURIComponent(analizada.username),
    contrasena: decodeURIComponent(analizada.password),
    base: decodeURIComponent(analizada.pathname.replace(/^\//, '')),
  };
}

/** El motor que corresponde a estas variables (lo usan las entidades al importarse). */
export function motorEfectivo(e: Crudo): Motor {
  const proveedor = texto(e, 'DB_PROVEEDOR');
  if (proveedor && proveedor in PRESETS_BASE) return PRESETS_BASE[proveedor as ProveedorBase].motor;
  const motor = texto(e, 'DB_MOTOR');
  return (MOTORES as readonly string[]).includes(motor ?? '') ? (motor as Motor) : 'better-sqlite3';
}

/**
 * Traduce un error de conexión a un mensaje en castellano que dice qué cambiar, o `null` si no
 * lo reconoce (en ese caso se muestra el error original).
 */
export function traducirErrorDeConexion(error: unknown, ssl: ModoSsl = 'no'): string | null {
  const texto =
    error instanceof Error
      ? `${error.message} ${String((error as { code?: unknown }).code ?? '')}`
      : String(error);
  if (/self[- ]signed|unable to verify|certificate|CERT_|UNABLE_TO_GET_ISSUER/i.test(texto)) {
    return ssl === 'si'
      ? 'No se pudo verificar el certificado de la base. Probá con DB_SSL=si-sin-verificar (cifra sin verificar), o pasá el certificado de la CA del proveedor en DB_SSL_CA.'
      : 'No se pudo verificar el certificado de la base. Poné DB_SSL=si-sin-verificar, o pasá el certificado de la CA del proveedor en DB_SSL_CA.';
  }
  if (/prepared statement/i.test(texto)) {
    return 'La base rechazó las consultas preparadas: estás usando el pooler en modo transacción. Usá el modo sesión (puerto 5432).';
  }
  if (/password authentication failed|Access denied|authentication failed|28P01/i.test(texto)) {
    return 'La base rechazó el usuario o la contraseña. Revisá DB_URL (si la contraseña tiene caracteres raros, escribilos con % en la URL).';
  }
  if (/no encryption|SSL.*required|requires? SSL|does not support SSL|server does not support/i.test(texto)) {
    return ssl === 'no'
      ? 'La base exige conexión cifrada. Poné DB_SSL=si-sin-verificar.'
      : 'La base no acepta conexión cifrada con esa configuración. Probá con DB_SSL=no.';
  }
  if (/ENETUNREACH|EHOSTUNREACH|EAFNOSUPPORT/i.test(texto)) {
    return 'No se pudo llegar a la base desde acá. Si es Supabase, usá la cadena del «Session pooler» (funciona por IPv4), no la conexión directa.';
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(texto)) {
    return 'No se encontró el servidor de la base. Revisá el host de DB_URL y tu conexión a internet.';
  }
  if (/ECONNREFUSED|ETIMEDOUT|timeout/i.test(texto)) {
    return 'La base no responde. Revisá el host y el puerto de DB_URL; si es un servicio gratis, puede estar pausado o dormido: reactivalo desde su panel y probá de nuevo.';
  }
  return null;
}
