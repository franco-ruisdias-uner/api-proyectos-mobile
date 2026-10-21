// Presets de proveedores de archivos compatibles con S3 (AGENTS §17.2). Una tabla de datos y
// una función pura: recibe el entorno y devuelve la configuración del cliente S3, o todo lo
// que falta explicado en castellano.

export type ProveedorS3 = 'aws' | 'supabase' | 'r2' | 'b2' | 's3proxy' | 'localstack';

export interface ConfiguracionS3 {
  proveedor: ProveedorS3;
  /** `undefined` = el de AWS. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  credenciales: { accessKeyId: string; secretAccessKey: string };
  /** Con un emulador, la API crea el bucket al arrancar. */
  crearBucket: boolean;
  /** Los servicios que no son AWS rechazan los checksums por defecto del SDK. */
  checksumsSoloSiHaceFalta: boolean;
}

export type ResultadoS3 =
  { ok: true; config: ConfiguracionS3 } | { ok: false; problemas: string[] };

type Entorno = Record<string, string | undefined>;

interface Preset {
  /** Variables propias del proveedor, además de las claves. */
  variables: { nombre: string; donde: string }[];
  pideRegion: boolean;
  pideBucket: boolean;
  pideClaves: boolean;
  region?: string;
  forcePathStyle: boolean;
  emulador: boolean;
  endpoint(env: Entorno): string | undefined;
}

const BUCKET_DONDE = 'el nombre del bucket que creaste en el panel del proveedor';
const REGION_DONDE = 'la región del bucket, que figura en el panel del proveedor';

export const PRESETS_S3: Record<ProveedorS3, Preset> = {
  aws: {
    variables: [],
    pideRegion: true,
    pideBucket: true,
    pideClaves: true,
    forcePathStyle: false,
    emulador: false,
    endpoint: () => undefined,
  },
  supabase: {
    variables: [
      {
        nombre: 'SUPABASE_PROYECTO',
        donde: 'el identificador de tu proyecto: las letras de https://<proyecto>.supabase.co',
      },
    ],
    pideRegion: true,
    pideBucket: true,
    pideClaves: true,
    forcePathStyle: true,
    emulador: false,
    endpoint: (env) => `https://${env.SUPABASE_PROYECTO}.storage.supabase.co/storage/v1/s3`,
  },
  r2: {
    variables: [{ nombre: 'R2_CUENTA', donde: 'el ID de cuenta de Cloudflare, en el panel de R2' }],
    pideRegion: false,
    pideBucket: true,
    pideClaves: true,
    region: 'auto',
    forcePathStyle: false,
    emulador: false,
    endpoint: (env) => `https://${env.R2_CUENTA}.r2.cloudflarestorage.com`,
  },
  b2: {
    variables: [],
    pideRegion: true,
    pideBucket: true,
    pideClaves: true,
    forcePathStyle: false,
    emulador: false,
    endpoint: (env) => `https://s3.${env.S3_REGION}.backblazeb2.com`,
  },
  s3proxy: {
    variables: [],
    pideRegion: false,
    pideBucket: false,
    pideClaves: false,
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: true,
    endpoint: () => 'http://s3:8080',
  },
  localstack: {
    variables: [],
    pideRegion: false,
    pideBucket: false,
    pideClaves: false,
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: true,
    endpoint: () => 'http://localstack:4566',
  },
};

const ES_PROVEEDOR_S3 = (nombre: string): nombre is ProveedorS3 => nombre in PRESETS_S3;
export const esProveedorS3 = ES_PROVEEDOR_S3;

/** Un entorno con valores vacíos cuenta como "no está". */
const valor = (env: Entorno, nombre: string): string | undefined => {
  const v = env[nombre]?.trim();
  return v ? v : undefined;
};

export function configuracionS3(proveedor: ProveedorS3, entrada: Entorno): ResultadoS3 {
  const preset = PRESETS_S3[proveedor];
  const env: Entorno = {};
  for (const nombre of Object.keys(entrada)) env[nombre] = valor(entrada, nombre);
  const problemas: string[] = [];
  const falta = (nombre: string, donde: string) =>
    problemas.push(`Falta ${nombre} (con ARCHIVOS_PROVEEDOR=${proveedor}): es ${donde}.`);

  for (const v of preset.variables) if (!env[v.nombre]) falta(v.nombre, v.donde);
  if (preset.pideBucket && !env.S3_BUCKET) falta('S3_BUCKET', BUCKET_DONDE);
  if (preset.pideRegion && !env.S3_REGION) falta('S3_REGION', REGION_DONDE);
  if (preset.pideClaves) {
    if (!env.S3_ACCESS_KEY_ID) {
      falta('S3_ACCESS_KEY_ID', 'la clave de acceso S3 que generás en el panel del proveedor');
    }
    if (!env.S3_SECRET_ACCESS_KEY) {
      falta('S3_SECRET_ACCESS_KEY', 'el secreto de esa clave de acceso (se muestra una sola vez)');
    }
  }

  let endpoint = preset.endpoint(env);
  if (env.S3_ENDPOINT) {
    try {
      const url = new URL(env.S3_ENDPOINT);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
      endpoint = env.S3_ENDPOINT.replace(/\/+$/, '');
    } catch {
      problemas.push(
        `S3_ENDPOINT tiene que ser una dirección http o https, por ejemplo https://s3.mi-servicio.com (vale "${env.S3_ENDPOINT}").`,
      );
    }
  }

  let forcePathStyle = preset.forcePathStyle;
  if (env.S3_FORZAR_PATH_STYLE !== undefined) {
    if (env.S3_FORZAR_PATH_STYLE !== 'true' && env.S3_FORZAR_PATH_STYLE !== 'false') {
      problemas.push(
        `S3_FORZAR_PATH_STYLE tiene que ser "true" o "false" (vale "${env.S3_FORZAR_PATH_STYLE}").`,
      );
    } else {
      forcePathStyle = env.S3_FORZAR_PATH_STYLE === 'true';
    }
  }

  let crearBucket = preset.emulador;
  if (env.ARCHIVOS_CREAR_BUCKET !== undefined) {
    if (env.ARCHIVOS_CREAR_BUCKET !== 'true' && env.ARCHIVOS_CREAR_BUCKET !== 'false') {
      problemas.push(
        `ARCHIVOS_CREAR_BUCKET tiene que ser "true" o "false" (vale "${env.ARCHIVOS_CREAR_BUCKET}").`,
      );
    } else {
      crearBucket = env.ARCHIVOS_CREAR_BUCKET === 'true';
    }
  }

  if (problemas.length > 0) return { ok: false, problemas };
  return {
    ok: true,
    config: {
      proveedor,
      endpoint,
      region: preset.region ?? env.S3_REGION!,
      forcePathStyle,
      bucket: env.S3_BUCKET ?? 'archivos',
      credenciales: {
        accessKeyId: env.S3_ACCESS_KEY_ID ?? 'clave-de-mentira',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? 'secreto-de-mentira',
      },
      crearBucket,
      checksumsSoloSiHaceFalta: proveedor !== 'aws',
    },
  };
}
