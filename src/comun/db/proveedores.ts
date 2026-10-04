// Presets de bases administradas en la nube (AGENTS §18.1): una variable, DB_PROVEEDOR,
// completa y valida lo que cada servicio necesita. Función pura, sin tocar la red.
export type EntornoCrudo = Record<string, string | undefined>;
export type ModoSsl = 'no' | 'si' | 'si-sin-verificar';
export const MODOS_SSL: readonly ModoSsl[] = ['no', 'si', 'si-sin-verificar'];

export const PROVEEDORES_DB = [
  'supabase',
  'neon',
  'aiven-postgres',
  'aiven-mysql',
] as const;
export type ProveedorDb = (typeof PROVEEDORES_DB)[number];

export interface ConfiguracionBase {
  motor: 'postgres' | 'mysql';
  ssl: ModoSsl;
  /** Sólo PostgreSQL. */
  esquema: string | null;
}

interface Preset {
  motor: 'postgres' | 'mysql';
  ssl: ModoSsl;
  esquema: string | null;
  validar: (url: URL) => string | null;
}

export const PRESETS_DB: Record<ProveedorDb, Preset> = {
  supabase: {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'api',
    validar: (url) => {
      if (!url.hostname.endsWith('.pooler.supabase.com')) {
        return url.hostname.startsWith('db.') &&
          url.hostname.endsWith('.supabase.co')
          ? 'DB_URL es la conexión directa de Supabase, que sólo anda por IPv6 y falla en Render. Usá el pooler en modo sesión: en Supabase, botón «Connect» → «Session pooler» (host …pooler.supabase.com, puerto 5432).'
          : 'DB_URL no parece de Supabase: el host tiene que terminar en .pooler.supabase.com (botón «Connect» → «Session pooler»).';
      }
      if (url.port === '6543')
        return 'DB_URL usa el pooler en modo transacción (puerto 6543), que no admite lo que necesita la API. Usá el pooler en modo sesión: puerto 5432.';
      if (url.port !== '5432' && url.port !== '')
        return `DB_URL tiene que usar el puerto 5432 del pooler en modo sesión (vino ${url.port}).`;
      if (!decodeURIComponent(url.username).startsWith('postgres.'))
        return 'El usuario de DB_URL tiene que ser postgres.<referencia del proyecto>, como lo muestra el pooler de Supabase.';
      return null;
    },
  },
  neon: {
    motor: 'postgres',
    ssl: 'si',
    esquema: 'public',
    validar: (url) =>
      url.hostname.endsWith('.neon.tech')
        ? null
        : 'DB_URL no parece de Neon: el host tiene que terminar en .neon.tech (panel de Neon → «Connect»).',
  },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
    validar: (url) =>
      url.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el host tiene que terminar en .aivencloud.com (consola de Aiven → «Service URI»).',
  },
  'aiven-mysql': {
    motor: 'mysql',
    ssl: 'si-sin-verificar',
    esquema: null,
    validar: (url) =>
      url.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el host tiene que terminar en .aivencloud.com (consola de Aiven → «Service URI»).',
  },
};

/** Configuración de la base según DB_PROVEEDOR, o el mensaje de lo que está mal. */
export function configuracionBase(
  entorno: EntornoCrudo,
): ConfiguracionBase | { error: string } | null {
  const texto = (n: string): string => entorno[n]?.trim() ?? '';
  const nombre = texto('DB_PROVEEDOR');
  if (nombre === '') return null;
  if (!(PROVEEDORES_DB as readonly string[]).includes(nombre))
    return {
      error: `DB_PROVEEDOR tiene que ser uno de: ${PROVEEDORES_DB.join(', ')} (vino "${nombre}").`,
    };
  const preset = PRESETS_DB[nombre as ProveedorDb];

  const dbUrl = texto('DB_URL');
  if (dbUrl === '')
    return {
      error: `Con DB_PROVEEDOR=${nombre} falta DB_URL, la cadena de conexión que da el proveedor.`,
    };
  let url: URL;
  try {
    url = new URL(dbUrl);
  } catch {
    return {
      error:
        'DB_URL no es una dirección válida (tiene que empezar con postgres:// o mysql://).',
    };
  }
  const protocolo =
    preset.motor === 'postgres' ? ['postgres:', 'postgresql:'] : ['mysql:'];
  if (!protocolo.includes(url.protocol))
    return {
      error: `Con DB_PROVEEDOR=${nombre}, DB_URL tiene que empezar con ${preset.motor === 'postgres' ? 'postgres://' : 'mysql://'}.`,
    };
  const problema = preset.validar(url);
  if (problema) return { error: problema };

  const ssl = texto('DB_SSL');
  if (ssl !== '' && !(MODOS_SSL as readonly string[]).includes(ssl))
    return {
      error: `DB_SSL tiene que ser uno de: ${MODOS_SSL.join(', ')} (vino "${ssl}").`,
    };
  const esquema = texto('DB_ESQUEMA') || preset.esquema;
  if (esquema !== null && !/^[a-z_][a-z0-9_]{0,62}$/.test(esquema))
    return {
      error:
        'DB_ESQUEMA tiene que ser un nombre en minúsculas, números y guion bajo.',
    };
  if (esquema !== null && preset.motor !== 'postgres')
    return { error: 'DB_ESQUEMA sólo se usa con PostgreSQL.' };
  const sslFinal = (ssl || preset.ssl) as ModoSsl;
  // Con una CA propia se verifica contra ella.
  return {
    motor: preset.motor,
    ssl:
      sslFinal === 'si-sin-verificar' && texto('DB_SSL_CA') !== ''
        ? 'si'
        : sslFinal,
    esquema,
  };
}

/** Un error de certificado, explicado en castellano. */
export function mensajeDeSsl(mensaje: string): string | null {
  return /self[- ]signed|certificate|CERT_|unable to verify/i.test(mensaje)
    ? 'El certificado de la base no se pudo verificar. Probá con DB_SSL=si-sin-verificar, o poné en DB_SSL_CA la ruta al certificado de la CA que da el proveedor.'
    : null;
}
