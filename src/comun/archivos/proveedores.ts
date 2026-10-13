// Presets de proveedores de archivos (AGENTS §17.2): una tabla de datos y una función pura.
// Todos los proveedores en la nube hablan el protocolo de S3: no hay un adaptador por proveedor.

export type Variables = Record<string, string | undefined>;

export const PROVEEDORES_S3 = [
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type ProveedorS3 = (typeof PROVEEDORES_S3)[number];

export interface ConfiguracionS3 {
  proveedor: ProveedorS3;
  /** `undefined` en AWS: el SDK arma el endpoint según la región. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  credenciales: { accessKeyId: string; secretAccessKey: string };
  crearBucket: boolean;
  redirigir: boolean;
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

export const PRESETS: Record<ProveedorS3, Preset> = {
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
      `https://${v('SUPABASE_PROYECTO')}.storage.supabase.co/storage/v1/s3`,
    region: null,
    pathStyle: true,
    variables: [
      {
        nombre: 'SUPABASE_PROYECTO',
        donde:
          'la referencia del proyecto: las letras de la dirección https://<referencia>.supabase.co (Project Settings → General)',
      },
    ],
    pideClaves: true,
    emulador: false,
  },
  r2: {
    endpoint: (v) => `https://${v('R2_CUENTA')}.r2.cloudflarestorage.com`,
    region: 'auto',
    pathStyle: false,
    variables: [
      {
        nombre: 'R2_CUENTA',
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

const VERDADEROS = ['true', '1', 'si', 'sí'];

function limpio(v: Variables, nombre: string): string | undefined {
  const valor = v[nombre]?.trim();
  return valor === undefined || valor === '' ? undefined : valor;
}

/**
 * Configuración del cliente S3 para el proveedor elegido, o la lista de problemas en castellano
 * (qué variable falta y dónde se consigue). `local` no usa S3: devuelve `null`.
 */
export function configuracionS3(
  entorno: Variables,
): ConfiguracionS3 | null | { problemas: string[] } {
  const nombre = limpio(entorno, 'ARCHIVOS_PROVEEDOR') ?? 'local';
  if (nombre === 'local') return null;
  if (!(PROVEEDORES_S3 as readonly string[]).includes(nombre)) {
    return {
      problemas: [
        `ARCHIVOS_PROVEEDOR="${nombre}" no existe. Opciones: local, ${PROVEEDORES_S3.join(', ')}.`,
      ],
    };
  }
  const proveedor = nombre as ProveedorS3;
  const preset = PRESETS[proveedor];
  const problemas: string[] = [];
  const falta = (variable: string, donde: string): string => {
    problemas.push(
      `Falta ${variable} (obligatoria con ARCHIVOS_PROVEEDOR=${proveedor}): es ${donde}.`,
    );
    return '';
  };
  const pedir = (variable: string, donde: string): string =>
    limpio(entorno, variable) ?? falta(variable, donde);

  for (const { nombre: variable, donde } of preset.variables) {
    pedir(variable, donde);
  }
  const bucket = preset.emulador
    ? (limpio(entorno, 'S3_BUCKET') ?? 'archivos')
    : pedir('S3_BUCKET', DONDE_BUCKET);
  const region =
    limpio(entorno, 'S3_REGION') ??
    preset.region ??
    falta('S3_REGION', DONDE_REGION);
  const accessKeyId = preset.pideClaves
    ? pedir(
        'S3_ACCESS_KEY_ID',
        'la clave de acceso (access key) que generaste en el panel del proveedor',
      )
    : (limpio(entorno, 'S3_ACCESS_KEY_ID') ?? 'clave-de-mentira');
  const secretAccessKey = preset.pideClaves
    ? pedir(
        'S3_SECRET_ACCESS_KEY',
        'la clave secreta (secret key) que se muestra una sola vez al generar la clave de acceso',
      )
    : (limpio(entorno, 'S3_SECRET_ACCESS_KEY') ?? 'clave-de-mentira');

  const endpointPisado = limpio(entorno, 'S3_ENDPOINT');
  if (endpointPisado !== undefined && !URL.canParse(endpointPisado)) {
    problemas.push('S3_ENDPOINT no es una dirección válida.');
  }
  const pathPisado = limpio(entorno, 'S3_FORZAR_PATH_STYLE')?.toLowerCase();

  if (problemas.length > 0) return { problemas };

  const valor = (n: string): string => limpio(entorno, n) ?? '';
  return {
    proveedor,
    endpoint: endpointPisado ?? preset.endpoint(valor),
    region,
    forcePathStyle:
      pathPisado === undefined
        ? preset.pathStyle
        : VERDADEROS.includes(pathPisado),
    bucket,
    credenciales: { accessKeyId, secretAccessKey },
    crearBucket: VERDADEROS.includes(
      limpio(entorno, 'ARCHIVOS_CREAR_BUCKET')?.toLowerCase() ??
        (preset.emulador ? 'true' : 'false'),
    ),
    redirigir: VERDADEROS.includes(
      limpio(entorno, 'ARCHIVOS_REDIRIGIR')?.toLowerCase() ?? 'false',
    ),
  };
}

export function esProblemas(
  r: ConfiguracionS3 | null | { problemas: string[] },
): r is { problemas: string[] } {
  return r !== null && 'problemas' in r;
}
