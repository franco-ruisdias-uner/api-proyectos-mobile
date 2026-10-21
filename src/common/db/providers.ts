// Presets de bases administradas en la nube (AGENTS §18.1): una tabla y una función pura.

/** Variables crudas del .env (texto) o ya validadas por Zod (con su tipo): se leen igual. */
export type Variables = Readonly<Record<string, unknown>>;
export type DbSslMode = 'off' | 'verify' | 'no-verify';
export type PresetEngine = 'postgres' | 'mysql';

export const DB_PROVIDERS = [
  'supabase',
  'neon',
  'aiven-postgres',
  'aiven-mysql',
] as const;
export type DbProvider = (typeof DB_PROVIDERS)[number];

interface Preset {
  engine: PresetEngine;
  ssl: DbSslMode;
  schema: string | null;
}

export const DB_PRESETS: Record<DbProvider, Preset> = {
  supabase: { engine: 'postgres', ssl: 'no-verify', schema: 'api' },
  neon: { engine: 'postgres', ssl: 'verify', schema: 'public' },
  'aiven-postgres': { engine: 'postgres', ssl: 'no-verify', schema: 'public' },
  'aiven-mysql': { engine: 'mysql', ssl: 'no-verify', schema: null },
};

export interface DbPreset {
  provider: DbProvider;
  engine: PresetEngine;
  url: string;
  ssl: DbSslMode;
  /** Ruta al certificado de la CA del proveedor; con ella el certificado se verifica. */
  sslCa: string | null;
  schema: string | null;
}

function clean(v: Variables, nombre: string): string | undefined {
  const valor = v[nombre];
  if (valor === undefined || valor === null) return undefined;
  const texto = String(valor).trim();
  return texto === '' ? undefined : texto;
}

export const SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const SSL_MODES: DbSslMode[] = ['off', 'verify', 'no-verify'];

/** `null` si no hay DB_PROVIDER; si no, la configuración o los problemas en castellano. */
export function dbPresetFromEnv(
  v: Variables,
): DbPreset | null | { problems: string[] } {
  const nombre = clean(v, 'DB_PROVIDER');
  if (nombre === undefined) return null;
  if (!(DB_PROVIDERS as readonly string[]).includes(nombre)) {
    return {
      problems: [
        `DB_PROVIDER="${nombre}" no existe. Opciones: ${DB_PROVIDERS.join(', ')} (o dejalo vacío para usar DB_ENGINE).`,
      ],
    };
  }
  const proveedor = nombre as DbProvider;
  const preset = DB_PRESETS[proveedor];
  const problems: string[] = [];

  const motorPedido = clean(v, 'DB_ENGINE');
  if (
    motorPedido !== undefined &&
    motorPedido !== 'better-sqlite3' &&
    motorPedido !== preset.engine
  ) {
    problems.push(
      `DB_PROVIDER=${proveedor} usa ${preset.engine}, pero DB_ENGINE dice "${motorPedido}". Borrá DB_ENGINE o poné "${preset.engine}".`,
    );
  }

  const textoUrl = clean(v, 'DB_URL');
  let url: URL | null = null;
  if (textoUrl === undefined) {
    problems.push(
      `Falta DB_URL: es la cadena de conexión que da ${proveedor} (la copiás del panel de la base).`,
    );
  } else if (!URL.canParse(textoUrl)) {
    problems.push(
      'DB_URL no es una dirección válida. Si la contraseña tiene caracteres como @, / o #, hay que codificarlos (por ejemplo @ → %40).',
    );
  } else {
    url = new URL(textoUrl);
    const protocolo = url.protocol.replace(':', '');
    const protocolosOk =
      preset.engine === 'postgres' ? ['postgres', 'postgresql'] : ['mysql'];
    if (!protocolosOk.includes(protocolo)) {
      problems.push(
        `DB_URL con ${proveedor} tiene que empezar con ${protocolosOk[0]}:// (empieza con ${protocolo}://).`,
      );
    }
  }

  if (url !== null) {
    const host = url.hostname;
    if (proveedor === 'supabase') {
      if (host.startsWith('db.') && host.endsWith('.supabase.co')) {
        problems.push(
          'Esa DB_URL es la conexión directa de Supabase, que sólo anda por IPv6 y no llega desde Render. ' +
            'Usá la del pooler en modo sesión: en Supabase, botón Connect → Session pooler (host …pooler.supabase.com, puerto 5432).',
        );
      } else if (!host.endsWith('.pooler.supabase.com')) {
        problems.push(
          'La DB_URL de Supabase tiene que ser la del pooler en modo sesión: host …pooler.supabase.com y puerto 5432 (Connect → Session pooler).',
        );
      } else if (url.port === '6543') {
        problems.push(
          'Esa DB_URL es del pooler en modo transacción (puerto 6543), que no admite prepared statements y la API no anda. ' +
            'Usá el modo sesión: mismo host, puerto 5432.',
        );
      } else if (url.port !== '' && url.port !== '5432') {
        problems.push(
          `La DB_URL de Supabase tiene que usar el puerto 5432 del pooler en modo sesión (tiene ${url.port}).`,
        );
      }
      if (
        host.endsWith('.pooler.supabase.com') &&
        !decodeURIComponent(url.username).startsWith('postgres.')
      ) {
        problems.push(
          'En el pooler de Supabase el usuario es postgres.<referencia-del-proyecto> (por ejemplo postgres.abcdefgh), no "postgres" a secas.',
        );
      }
    } else if (proveedor === 'neon' && !host.endsWith('.neon.tech')) {
      problems.push(
        'La DB_URL de Neon tiene que tener un host que termine en .neon.tech (copiala del panel de Neon, Connect).',
      );
    } else if (
      proveedor.startsWith('aiven') &&
      !host.endsWith('.aivencloud.com')
    ) {
      problems.push(
        'La DB_URL de Aiven tiene que tener un host que termine en .aivencloud.com (copiala de la pantalla del servicio).',
      );
    }
  }

  const sslTexto = clean(v, 'DB_SSL')?.toLowerCase();
  if (sslTexto !== undefined && !SSL_MODES.includes(sslTexto as DbSslMode)) {
    problems.push(
      `DB_SSL tiene que ser "off", "verify" o "no-verify" (vino "${sslTexto}").`,
    );
  }
  const esquemaPedido = clean(v, 'DB_SCHEMA');
  if (esquemaPedido !== undefined && !SCHEMA_NAME.test(esquemaPedido)) {
    problems.push(
      'DB_SCHEMA tiene que ser un nombre simple: letras, números y guion bajo, sin espacios ni símbolos.',
    );
  }
  if (problems.length > 0 || url === null) return { problems };

  const schema =
    preset.engine === 'postgres'
      ? (clean(v, 'DB_SCHEMA') ?? preset.schema)
      : null;
  return {
    provider: proveedor,
    engine: preset.engine,
    url: textoUrl as string,
    ssl: (sslTexto as DbSslMode | undefined) ?? preset.ssl,
    sslCa: clean(v, 'DB_SSL_CA') ?? null,
    schema,
  };
}

export function hasDbProblems(
  r: DbPreset | null | { problems: string[] },
): r is { problems: string[] } {
  return r !== null && 'problems' in r;
}
