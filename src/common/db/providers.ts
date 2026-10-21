// Presets de bases administradas (AGENTS §18.1): una tabla de datos y una función pura que
// completa motor, SSL y esquema, y valida DB_URL con mensajes en castellano.

export const PROVEEDORES_DB = [
  'supabase',
  'neon',
  'aiven-postgres',
  'aiven-mysql',
] as const;
export type ProveedorDb = (typeof PROVEEDORES_DB)[number];

export type MotorDb = 'better-sqlite3' | 'postgres' | 'mysql' | 'mariadb';
export type ModoSsl = 'no' | 'si' | 'si-sin-verificar';
export const MODOS_SSL: readonly ModoSsl[] = ['no', 'si', 'si-sin-verificar'];

export type Variables = Record<string, string | undefined>;

interface Preset {
  motor: 'postgres' | 'mysql';
  ssl: ModoSsl;
  esquema: string | null;
  validarUrl: (url: URL) => string[];
}

const hostTermina = (url: URL, sufijo: string) => url.hostname.endsWith(sufijo);

export const PRESETS_DB: Record<ProveedorDb, Preset> = {
  supabase: {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'api',
    validarUrl: (url) => {
      const problemas: string[] = [];
      if (url.port === '6543') {
        problemas.push(
          'DB_URL usa el pooler en modo transacción (puerto 6543), que no admite prepared statements. Usá el pooler en modo sesión: mismo host, puerto 5432 (Supabase → Connect → Session pooler).',
        );
      } else if (!hostTermina(url, '.pooler.supabase.com')) {
        problemas.push(
          'DB_URL tiene que ser la del pooler en modo sesión de Supabase (host …pooler.supabase.com, puerto 5432): la conexión directa (db.<ref>.supabase.co) es sólo IPv6 y los hosts como Render no la alcanzan. Copiala de Supabase → Connect → Session pooler.',
        );
      } else if (url.port !== '' && url.port !== '5432') {
        problemas.push(
          `DB_URL tiene que usar el puerto 5432 del pooler en modo sesión (vino ${url.port}).`,
        );
      }
      if (
        problemas.length === 0 &&
        !decodeURIComponent(url.username).startsWith('postgres.')
      ) {
        problemas.push(
          'El usuario de DB_URL tiene que ser postgres.<referencia del proyecto> (así lo pide el pooler de Supabase).',
        );
      }
      return problemas;
    },
  },
  neon: {
    motor: 'postgres',
    ssl: 'si',
    esquema: 'public',
    validarUrl: (url) =>
      hostTermina(url, '.neon.tech')
        ? []
        : [
            'DB_URL tiene que ser la de Neon (host …neon.tech). Copiala del panel de Neon → Connect.',
          ],
  },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
    validarUrl: (url) =>
      hostTermina(url, '.aivencloud.com')
        ? []
        : [
            'DB_URL tiene que ser la de Aiven (host …aivencloud.com). Copiala del panel de Aiven → Service URI.',
          ],
  },
  'aiven-mysql': {
    motor: 'mysql',
    ssl: 'si-sin-verificar',
    esquema: null,
    validarUrl: (url) =>
      hostTermina(url, '.aivencloud.com')
        ? []
        : [
            'DB_URL tiene que ser la de Aiven (host …aivencloud.com). Copiala del panel de Aiven → Service URI.',
          ],
  },
};

const vacio = (v: string | undefined) => v === undefined || v.trim() === '';

export const esProveedorDb = (valor: string): valor is ProveedorDb =>
  (PROVEEDORES_DB as readonly string[]).includes(valor);

/** Motor implícito de DB_PROVEEDOR (o null si no hay proveedor o no se reconoce). */
export function motorDeProveedor(
  proveedor: string | undefined,
): MotorDb | null {
  const p = proveedor?.trim();
  return p && esProveedorDb(p) ? PRESETS_DB[p].motor : null;
}

export interface ConfiguracionBase {
  proveedor: ProveedorDb | null;
  motor: MotorDb;
  /** Sólo PostgreSQL. */
  esquema: string | null;
  ssl: ModoSsl;
  /** Ruta al certificado de la CA del proveedor. */
  sslCa: string | null;
  /** DB_URL descompuesta y decodificada (nunca con expresiones regulares). */
  conexion: {
    host: string;
    port: number | undefined;
    username: string;
    password: string;
    database: string;
  } | null;
}

export type ResultadoBase =
  { ok: true; config: ConfiguracionBase } | { ok: false; problemas: string[] };

/** Descompone una URL de base de datos; usuario y contraseña se decodifican. */
export function parsearUrlDb(texto: string): URL | null {
  try {
    const url = new URL(texto);
    return url.hostname === '' ? null : url;
  } catch {
    return null;
  }
}

export function configuracionBase(entorno: Variables): ResultadoBase {
  const problemas: string[] = [];
  const nombre = entorno.DB_PROVEEDOR?.trim() || null;
  const motorPedido = entorno.DB_MOTOR?.trim() || null;

  let preset: Preset | null = null;
  if (nombre !== null) {
    if (!esProveedorDb(nombre)) {
      return {
        ok: false,
        problemas: [
          `DB_PROVEEDOR tiene que ser uno de: ${PROVEEDORES_DB.join(', ')} (vino "${nombre}"). Si usás una base común, dejalo vacío.`,
        ],
      };
    }
    preset = PRESETS_DB[nombre];
    if (motorPedido !== null && motorPedido !== preset.motor) {
      problemas.push(
        `DB_PROVEEDOR=${nombre} usa ${preset.motor}, pero DB_MOTOR dice ${motorPedido}. Sacá DB_MOTOR: el proveedor ya lo define.`,
      );
    }
  }

  const motor = (preset?.motor ?? motorPedido ?? 'better-sqlite3') as MotorDb;

  let modo: ModoSsl = preset?.ssl ?? 'no';
  if (!vacio(entorno.DB_SSL)) {
    const pedido = entorno.DB_SSL!.trim() as ModoSsl;
    if (MODOS_SSL.includes(pedido)) modo = pedido;
    else
      problemas.push(
        `DB_SSL tiene que ser uno de: ${MODOS_SSL.join(', ')} (vino "${pedido}").`,
      );
  }
  const sslCa = vacio(entorno.DB_SSL_CA) ? null : entorno.DB_SSL_CA!.trim();
  if (sslCa !== null && modo === 'no') {
    problemas.push('DB_SSL_CA sólo sirve con DB_SSL=si o si-sin-verificar.');
  }
  // Con la CA del proveedor se verifica el certificado.
  if (sslCa !== null && modo === 'si-sin-verificar') modo = 'si';

  const esquemaPedido = vacio(entorno.DB_ESQUEMA)
    ? null
    : entorno.DB_ESQUEMA!.trim();
  if (esquemaPedido !== null && motor !== 'postgres') {
    problemas.push('DB_ESQUEMA sólo se usa con PostgreSQL.');
  }
  if (
    esquemaPedido !== null &&
    !/^[a-z_][a-z0-9_]{0,62}$/.test(esquemaPedido)
  ) {
    problemas.push(
      'DB_ESQUEMA tiene que ser un nombre simple: minúsculas, números y guion bajo (por ejemplo api).',
    );
  }
  const esquema =
    motor === 'postgres' ? (esquemaPedido ?? preset?.esquema ?? null) : null;

  let conexion: ConfiguracionBase['conexion'] = null;
  if (preset !== null) {
    if (vacio(entorno.DB_URL)) {
      problemas.push(
        `Con DB_PROVEEDOR=${nombre} falta DB_URL: la cadena de conexión que da el panel del proveedor.`,
      );
    } else {
      const url = parsearUrlDb(entorno.DB_URL!.trim());
      if (url === null) {
        problemas.push(
          'DB_URL no se entiende como dirección. Si la contraseña tiene caracteres como @ o /, escribilos codificados (%40, %2F).',
        );
      } else {
        const propios = preset.validarUrl(url);
        problemas.push(...propios);
        conexion = {
          host: url.hostname,
          port: url.port === '' ? undefined : Number(url.port),
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
          database: decodeURIComponent(url.pathname.replace(/^\//, '')),
        };
      }
    }
  }

  if (problemas.length > 0) return { ok: false, problemas };
  return {
    ok: true,
    config: {
      proveedor: nombre as ProveedorDb | null,
      motor,
      esquema,
      ssl: modo,
      sslCa,
      conexion,
    },
  };
}
