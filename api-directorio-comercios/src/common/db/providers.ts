/**
 * Presets de bases administradas (AGENTS §18.1). `DB_PROVEEDOR` completa el motor, el SSL y el
 * esquema, y valida la forma de `DB_URL`. Sin `DB_PROVEEDOR` todo sigue como en la §5.1.
 */
export const MOTORES = ['better-sqlite3', 'postgres', 'mysql', 'mariadb'] as const;
export type Motor = (typeof MOTORES)[number];

export const PROVEEDORES_DB = ['supabase', 'neon', 'aiven-postgres', 'aiven-mysql'] as const;
export type ProveedorDb = (typeof PROVEEDORES_DB)[number];

export const MODOS_SSL = ['no', 'si', 'si-sin-verificar'] as const;
export type ModoSsl = (typeof MODOS_SSL)[number];

export interface ConfiguracionBase {
  motor: Motor;
  proveedor: ProveedorDb | null;
  url: string | null;
  archivo: string;
  ssl: ModoSsl;
  sslCa: string | null;
  esquema: string | null;
}

export type ResultadoBase = { config: ConfiguracionBase } | { errores: string[] };

interface PresetDb {
  motor: Motor;
  ssl: ModoSsl;
  esquema: string | null;
  /** Devuelve el problema en castellano, o null si la URL sirve. */
  validarUrl: (url: URL) => string | null;
}

export const PRESETS_DB: Record<ProveedorDb, PresetDb> = {
  supabase: {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'api',
    validarUrl: (u) => {
      if (/^db\.[^.]+\.supabase\.co$/.test(u.hostname)) {
        return (
          'DB_URL es la conexión directa de Supabase, que es sólo IPv6 y no anda desde Render. ' +
          'Usá la del pooler en modo sesión: Connect → «Session pooler» (host …pooler.supabase.com, puerto 5432).'
        );
      }
      if (!u.hostname.endsWith('.pooler.supabase.com')) {
        return 'DB_URL no parece de Supabase: el host tiene que terminar en .pooler.supabase.com (Connect → «Session pooler»).';
      }
      if (u.port === '6543') {
        return (
          'DB_URL usa el pooler en modo transacción (puerto 6543), que no admite lo que necesita la API. ' +
          'Usá el modo sesión: el mismo host con el puerto 5432.'
        );
      }
      if (u.port !== '' && u.port !== '5432') {
        return `DB_URL usa el puerto ${u.port}, pero el pooler en modo sesión de Supabase es el 5432.`;
      }
      if (!decodeURIComponent(u.username).startsWith('postgres.')) {
        return 'DB_URL: el usuario del pooler de Supabase tiene la forma postgres.<id del proyecto>.';
      }
      return null;
    },
  },
  neon: {
    motor: 'postgres',
    ssl: 'si',
    esquema: 'public',
    validarUrl: (u) =>
      u.hostname.endsWith('.neon.tech')
        ? null
        : 'DB_URL no parece de Neon: el host tiene que terminar en .neon.tech.',
  },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
    validarUrl: (u) =>
      u.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el host tiene que terminar en .aivencloud.com.',
  },
  'aiven-mysql': {
    motor: 'mysql',
    ssl: 'si-sin-verificar',
    esquema: null,
    validarUrl: (u) =>
      u.hostname.endsWith('.aivencloud.com')
        ? null
        : 'DB_URL no parece de Aiven: el host tiene que terminar en .aivencloud.com.',
  },
};

/** Parte `DB_URL` con `URL` y decodifica usuario, clave y base (nunca con una regex). */
export function partesDeUrl(texto: string) {
  const u = new URL(texto);
  return {
    host: u.hostname,
    puerto: u.port === '' ? undefined : Number(u.port),
    usuario: decodeURIComponent(u.username),
    clave: decodeURIComponent(u.password),
    base: decodeURIComponent(u.pathname.replace(/^\//, '')),
  };
}

export function configuracionBase(variables: Record<string, unknown>): ResultadoBase {
  const errores: string[] = [];
  const texto = (n: string): string | undefined => {
    const v = variables[n];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };

  const proveedorTexto = texto('DB_PROVEEDOR');
  let proveedor: ProveedorDb | null = null;
  if (proveedorTexto !== undefined) {
    if ((PROVEEDORES_DB as readonly string[]).includes(proveedorTexto)) {
      proveedor = proveedorTexto as ProveedorDb;
    } else {
      errores.push(
        `DB_PROVEEDOR vale "${proveedorTexto}", pero tiene que ser uno de: ${PROVEEDORES_DB.join(', ')} (o dejarlo vacío).`,
      );
    }
  }
  const preset = proveedor ? PRESETS_DB[proveedor] : null;

  const motorTexto = texto('DB_MOTOR');
  let motor: Motor = preset?.motor ?? 'better-sqlite3';
  if (!preset && motorTexto !== undefined) {
    if ((MOTORES as readonly string[]).includes(motorTexto)) motor = motorTexto as Motor;
    else {
      errores.push(
        `DB_MOTOR vale "${motorTexto}", pero tiene que ser uno de: ${MOTORES.join(', ')}.`,
      );
    }
  }

  let url: string | null = null;
  const urlTexto = texto('DB_URL');
  if (urlTexto !== undefined) {
    try {
      const parseada = new URL(urlTexto);
      url = urlTexto;
      const problema = preset?.validarUrl(parseada);
      if (problema) errores.push(problema);
    } catch {
      errores.push(
        `DB_URL no es una dirección válida. Tiene que verse así: ${
          motor === 'postgres'
            ? 'postgres://usuario:clave@servidor:5432/base'
            : 'mysql://usuario:clave@servidor:3306/base'
        }. Si la clave tiene símbolos raros (@, /, #), escribilos codificados (%40, %2F, %23).`,
      );
    }
  } else if (motor !== 'better-sqlite3') {
    errores.push(
      `Falta DB_URL: con ${proveedor ? `DB_PROVEEDOR=${proveedor}` : `DB_MOTOR=${motor}`} hace falta la dirección de la base, por ejemplo ` +
        (motor === 'postgres'
          ? 'postgres://usuario:clave@localhost:5432/api'
          : 'mysql://usuario:clave@localhost:3306/api') +
        '. Mirá .env.example.',
    );
  }

  let ssl: ModoSsl = preset?.ssl ?? 'no';
  const sslTexto = texto('DB_SSL');
  if (sslTexto !== undefined) {
    if ((MODOS_SSL as readonly string[]).includes(sslTexto)) ssl = sslTexto as ModoSsl;
    else
      errores.push(
        `DB_SSL vale "${sslTexto}", pero tiene que ser uno de: ${MODOS_SSL.join(', ')}.`,
      );
  }
  const sslCa = texto('DB_SSL_CA') ?? null;
  // Con la CA del proveedor se verifica el certificado.
  if (sslCa && ssl === 'si-sin-verificar') ssl = 'si';

  const esquema = texto('DB_ESQUEMA') ?? preset?.esquema ?? null;
  if (esquema !== null) {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(esquema)) {
      errores.push(
        `DB_ESQUEMA vale "${esquema}", pero tiene que ser un nombre en minúsculas, números y guiones bajos (por ejemplo api).`,
      );
    }
    if (motor !== 'postgres' && texto('DB_ESQUEMA') !== undefined) {
      errores.push('DB_ESQUEMA sólo se usa con PostgreSQL.');
    }
  }

  if (errores.length > 0) return { errores };
  return {
    config: {
      motor,
      proveedor,
      url,
      archivo: texto('DB_ARCHIVO') ?? 'datos/api.sqlite',
      ssl,
      sslCa,
      esquema: motor === 'postgres' ? esquema : null,
    },
  };
}

/** Un error de certificado → qué opción de DB_SSL probar. */
export function explicarErrorDeBase(error: Error, ssl: ModoSsl): string {
  const m = error.message;
  if (/self.signed|unable to verify|certificate|CERT_/i.test(m)) {
    return ssl === 'si'
      ? 'El certificado del servidor no se pudo verificar. Bajá la CA del proveedor y ponela en DB_SSL_CA, o probá DB_SSL=si-sin-verificar.'
      : 'El certificado del servidor no se pudo verificar. Ponele a DB_SSL_CA la ruta a la CA que da el proveedor.';
  }
  if (/SSL|TLS/i.test(m) && /required|does not support|no pg_hba/i.test(m)) {
    return 'El servidor exige conexión cifrada: poné DB_SSL=si-sin-verificar (o si).';
  }
  if (/password authentication failed|Access denied/i.test(m)) {
    return 'Usuario o contraseña incorrectos. Revisá DB_URL (los símbolos raros de la contraseña van codificados: @ → %40).';
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) {
    return 'No se encontró el servidor. Revisá el host de DB_URL (y que estés usando el pooler en modo sesión si es Supabase, porque la conexión directa es sólo IPv6).';
  }
  if (/ECONNREFUSED|ETIMEDOUT/i.test(m)) {
    return 'No hay conexión con el servidor. Revisá el host y el puerto de DB_URL, y que la base no esté pausada.';
  }
  if (/Tenant or user not found/i.test(m)) {
    return 'Supabase no reconoce el usuario. En el pooler tiene la forma postgres.<id del proyecto>.';
  }
  return m;
}
