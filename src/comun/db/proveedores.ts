// Presets de bases administradas en la nube (AGENTS §18.1): una tabla y una función pura.

export type Variables = Record<string, string | undefined>;
export type ModoSsl = 'no' | 'si' | 'si-sin-verificar';
export type MotorBase = 'postgres' | 'mysql';

export const PROVEEDORES_DB = [
  'supabase',
  'neon',
  'aiven-postgres',
  'aiven-mysql',
] as const;
export type ProveedorDb = (typeof PROVEEDORES_DB)[number];

interface Preset {
  motor: MotorBase;
  ssl: ModoSsl;
  esquema: string | null;
}

export const PRESETS_DB: Record<ProveedorDb, Preset> = {
  supabase: { motor: 'postgres', ssl: 'si-sin-verificar', esquema: 'api' },
  neon: { motor: 'postgres', ssl: 'si', esquema: 'public' },
  'aiven-postgres': {
    motor: 'postgres',
    ssl: 'si-sin-verificar',
    esquema: 'public',
  },
  'aiven-mysql': { motor: 'mysql', ssl: 'si-sin-verificar', esquema: null },
};

export interface ConfiguracionBase {
  proveedor: ProveedorDb;
  motor: MotorBase;
  url: string;
  ssl: ModoSsl;
  /** Ruta al certificado de la CA del proveedor; con ella el certificado se verifica. */
  sslCa: string | null;
  esquema: string | null;
}

function limpio(v: Variables, nombre: string): string | undefined {
  const valor = v[nombre]?.trim();
  return valor === undefined || valor === '' ? undefined : valor;
}

export const ESQUEMA_VALIDO = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const SSL_VALIDOS: ModoSsl[] = ['no', 'si', 'si-sin-verificar'];

/** Motor que corresponde según el entorno (el preset manda sobre DB_MOTOR). */
export function motorDelEntorno(v: Variables): string {
  const proveedor = limpio(v, 'DB_PROVEEDOR');
  if (proveedor && proveedor in PRESETS_DB)
    return PRESETS_DB[proveedor as ProveedorDb].motor;
  return limpio(v, 'DB_MOTOR') ?? 'better-sqlite3';
}

/** `null` si no hay DB_PROVEEDOR; si no, la configuración o los problemas en castellano. */
export function configuracionBase(
  v: Variables,
): ConfiguracionBase | null | { problemas: string[] } {
  const nombre = limpio(v, 'DB_PROVEEDOR');
  if (nombre === undefined) return null;
  if (!(PROVEEDORES_DB as readonly string[]).includes(nombre)) {
    return {
      problemas: [
        `DB_PROVEEDOR="${nombre}" no existe. Opciones: ${PROVEEDORES_DB.join(', ')} (o dejalo vacío para usar DB_MOTOR).`,
      ],
    };
  }
  const proveedor = nombre as ProveedorDb;
  const preset = PRESETS_DB[proveedor];
  const problemas: string[] = [];

  const motorPedido = limpio(v, 'DB_MOTOR');
  if (
    motorPedido !== undefined &&
    motorPedido !== 'better-sqlite3' &&
    motorPedido !== preset.motor
  ) {
    problemas.push(
      `DB_PROVEEDOR=${proveedor} usa ${preset.motor}, pero DB_MOTOR dice "${motorPedido}". Borrá DB_MOTOR o poné "${preset.motor}".`,
    );
  }

  const textoUrl = limpio(v, 'DB_URL');
  let url: URL | null = null;
  if (textoUrl === undefined) {
    problemas.push(
      `Falta DB_URL: es la cadena de conexión que da ${proveedor} (la copiás del panel de la base).`,
    );
  } else if (!URL.canParse(textoUrl)) {
    problemas.push(
      'DB_URL no es una dirección válida. Si la contraseña tiene caracteres como @, / o #, hay que codificarlos (por ejemplo @ → %40).',
    );
  } else {
    url = new URL(textoUrl);
    const protocolo = url.protocol.replace(':', '');
    const protocolosOk =
      preset.motor === 'postgres' ? ['postgres', 'postgresql'] : ['mysql'];
    if (!protocolosOk.includes(protocolo)) {
      problemas.push(
        `DB_URL con ${proveedor} tiene que empezar con ${protocolosOk[0]}:// (empieza con ${protocolo}://).`,
      );
    }
  }

  if (url !== null) {
    const host = url.hostname;
    if (proveedor === 'supabase') {
      if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
        problemas.push(
          'Esa DB_URL es la conexión directa de Supabase, que sólo anda por IPv6 y no llega desde Render. ' +
            'Usá la del pooler en modo sesión: en Supabase, botón Connect → Session pooler (host …pooler.supabase.com, puerto 5432).',
        );
      } else if (!host.endsWith('.pooler.supabase.com')) {
        problemas.push(
          'La DB_URL de Supabase tiene que ser la del pooler en modo sesión: host …pooler.supabase.com y puerto 5432 (Connect → Session pooler).',
        );
      } else if (url.port === '6543') {
        problemas.push(
          'Esa DB_URL es del pooler en modo transacción (puerto 6543), que no admite prepared statements y la API no anda. ' +
            'Usá el modo sesión: mismo host, puerto 5432.',
        );
      } else if (url.port !== '' && url.port !== '5432') {
        problemas.push(
          `La DB_URL de Supabase tiene que usar el puerto 5432 del pooler en modo sesión (tiene ${url.port}).`,
        );
      }
      if (
        host.endsWith('.pooler.supabase.com') &&
        !decodeURIComponent(url.username).startsWith('postgres.')
      ) {
        problemas.push(
          'En el pooler de Supabase el usuario es postgres.<referencia-del-proyecto> (por ejemplo postgres.abcdefgh), no "postgres" a secas.',
        );
      }
    } else if (proveedor === 'neon' && !host.endsWith('.neon.tech')) {
      problemas.push(
        'La DB_URL de Neon tiene que tener un host que termine en .neon.tech (copiala del panel de Neon, Connect).',
      );
    } else if (
      proveedor.startsWith('aiven') &&
      !host.endsWith('.aivencloud.com')
    ) {
      problemas.push(
        'La DB_URL de Aiven tiene que tener un host que termine en .aivencloud.com (copiala de la pantalla del servicio).',
      );
    }
  }

  const sslTexto = limpio(v, 'DB_SSL')?.toLowerCase();
  if (sslTexto !== undefined && !SSL_VALIDOS.includes(sslTexto as ModoSsl)) {
    problemas.push(
      `DB_SSL tiene que ser "no", "si" o "si-sin-verificar" (vino "${sslTexto}").`,
    );
  }
  const esquemaPedido = limpio(v, 'DB_ESQUEMA');
  if (esquemaPedido !== undefined && !ESQUEMA_VALIDO.test(esquemaPedido)) {
    problemas.push(
      'DB_ESQUEMA tiene que ser un nombre simple: letras, números y guion bajo, sin espacios ni símbolos.',
    );
  }
  if (problemas.length > 0 || url === null) return { problemas };

  const esquema =
    preset.motor === 'postgres'
      ? (limpio(v, 'DB_ESQUEMA') ?? preset.esquema)
      : null;
  return {
    proveedor,
    motor: preset.motor,
    url: textoUrl as string,
    ssl: (sslTexto as ModoSsl | undefined) ?? preset.ssl,
    sslCa: limpio(v, 'DB_SSL_CA') ?? null,
    esquema,
  };
}

export function hayProblemasDb(
  r: ConfiguracionBase | null | { problemas: string[] },
): r is { problemas: string[] } {
  return r !== null && 'problemas' in r;
}
