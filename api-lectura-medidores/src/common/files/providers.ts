// Presets de proveedores de archivos (AGENTS §17.2): una tabla de datos y una función pura.
// Todos los proveedores en la nube hablan el protocolo de S3: no hay un adaptador por proveedor.

/** Variables crudas del .env (texto) o ya validadas por Zod (con su tipo): se leen igual. */
export type Variables = Readonly<Record<string, unknown>>;

export const S3_PROVIDERS = [
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type S3Provider = (typeof S3_PROVIDERS)[number];

export interface S3Config {
  provider: S3Provider;
  /** `undefined` en AWS: el SDK arma el endpoint según la región. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  createBucket: boolean;
  redirect: boolean;
}

interface Preset {
  endpoint: (v: (n: string) => string) => string | undefined;
  region: string | null; // null: la pide el usuario
  pathStyle: boolean;
  /** Variables propias del proveedor, además de bucket y claves. */
  variables: Array<{ nombre: string; donde: string }>;
  pideClaves: boolean;
  emulador: boolean;
}

const DONDE_BUCKET =
  'el nombre del bucket que creaste en el panel del proveedor';
const DONDE_REGION =
  'la región del bucket, que se ve en el panel del proveedor';

export const S3_PRESETS: Record<S3Provider, Preset> = {
  aws: {
    endpoint: () => undefined,
    region: null,
    pathStyle: false,
    variables: [],
    pideClaves: true,
    emulador: false,
  },
  supabase: {
    endpoint: (v) =>
      `https://${v('SUPABASE_PROJECT_REF')}.storage.supabase.co/storage/v1/s3`,
    region: null,
    pathStyle: true,
    variables: [
      {
        nombre: 'SUPABASE_PROJECT_REF',
        donde:
          'la referencia del proyecto: las letras de la dirección https://<referencia>.supabase.co (Project Settings → General)',
      },
    ],
    pideClaves: true,
    emulador: false,
  },
  r2: {
    endpoint: (v) => `https://${v('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    region: 'auto',
    pathStyle: false,
    variables: [
      {
        nombre: 'R2_ACCOUNT_ID',
        donde: 'el ID de cuenta de Cloudflare (panel de R2, a la derecha)',
      },
    ],
    pideClaves: true,
    emulador: false,
  },
  b2: {
    endpoint: (v) => `https://s3.${v('S3_REGION')}.backblazeb2.com`,
    region: null,
    pathStyle: false,
    variables: [],
    pideClaves: true,
    emulador: false,
  },
  s3proxy: {
    endpoint: () => 'http://s3:8080',
    region: 'us-east-1',
    pathStyle: true,
    variables: [],
    pideClaves: false,
    emulador: true,
  },
  localstack: {
    endpoint: () => 'http://localstack:4566',
    region: 'us-east-1',
    pathStyle: true,
    variables: [],
    pideClaves: false,
    emulador: true,
  },
};

const TRUE_VALUES = ['true', '1', 'yes'];

function clean(v: Variables, nombre: string): string | undefined {
  const valor = v[nombre];
  if (valor === undefined || valor === null) return undefined;
  const texto = String(valor).trim();
  return texto === '' ? undefined : texto;
}

/**
 * Configuración del cliente S3 para el proveedor elegido, o la lista de problemas en castellano
 * (qué variable falta y dónde se consigue). `local` no usa S3: devuelve `null`.
 */
export function s3ConfigFromEnv(
  entorno: Variables,
): S3Config | null | { problems: string[] } {
  const nombre = clean(entorno, 'STORAGE_PROVIDER') ?? 'local';
  if (nombre === 'local') return null;
  if (!(S3_PROVIDERS as readonly string[]).includes(nombre)) {
    return {
      problems: [
        `STORAGE_PROVIDER="${nombre}" no existe. Opciones: local, ${S3_PROVIDERS.join(', ')}.`,
      ],
    };
  }
  const proveedor = nombre as S3Provider;
  const preset = S3_PRESETS[proveedor];
  const problems: string[] = [];
  const falta = (variable: string, donde: string): string => {
    problems.push(
      `Falta ${variable} (obligatoria con STORAGE_PROVIDER=${proveedor}): es ${donde}.`,
    );
    return '';
  };
  const pedir = (variable: string, donde: string): string =>
    clean(entorno, variable) ?? falta(variable, donde);

  for (const { nombre: variable, donde } of preset.variables) {
    pedir(variable, donde);
  }
  const bucket = preset.emulador
    ? (clean(entorno, 'S3_BUCKET') ?? 'archivos')
    : pedir('S3_BUCKET', DONDE_BUCKET);
  // Con región fija (R2: "auto") S3_REGION no se tiene en cuenta: otra región rompe las firmas.
  const region =
    preset.region ??
    clean(entorno, 'S3_REGION') ??
    falta('S3_REGION', DONDE_REGION);
  const accessKeyId = preset.pideClaves
    ? pedir(
        'S3_ACCESS_KEY_ID',
        'la clave de acceso (access key) que generaste en el panel del proveedor',
      )
    : (clean(entorno, 'S3_ACCESS_KEY_ID') ?? 'clave-de-mentira');
  const secretAccessKey = preset.pideClaves
    ? pedir(
        'S3_SECRET_ACCESS_KEY',
        'la clave secreta (secret key) que se muestra una sola vez al generar la clave de acceso',
      )
    : (clean(entorno, 'S3_SECRET_ACCESS_KEY') ?? 'clave-de-mentira');

  const endpointPisado = clean(entorno, 'S3_ENDPOINT');
  if (endpointPisado !== undefined && !URL.canParse(endpointPisado)) {
    problems.push('S3_ENDPOINT no es una dirección válida.');
  }
  const pathPisado = clean(entorno, 'S3_FORCE_PATH_STYLE')?.toLowerCase();

  if (problems.length > 0) return { problems };

  const valor = (n: string): string => clean(entorno, n) ?? '';
  return {
    provider: proveedor,
    endpoint: endpointPisado ?? preset.endpoint(valor),
    region,
    forcePathStyle:
      pathPisado === undefined
        ? preset.pathStyle
        : TRUE_VALUES.includes(pathPisado),
    bucket,
    credentials: { accessKeyId, secretAccessKey },
    createBucket: TRUE_VALUES.includes(
      clean(entorno, 'S3_CREATE_BUCKET')?.toLowerCase() ??
        (preset.emulador ? 'true' : 'false'),
    ),
    redirect: TRUE_VALUES.includes(
      clean(entorno, 'STORAGE_REDIRECT')?.toLowerCase() ?? 'false',
    ),
  };
}

export function hasS3Problems(
  r: S3Config | null | { problems: string[] },
): r is { problems: string[] } {
  return r !== null && 'problems' in r;
}
