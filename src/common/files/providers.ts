// Presets de proveedores de archivos (AGENTS §17.2): una tabla de datos y una función
// pura que completa endpoint, región y estilo de ruta, y valida las variables que faltan.
export type EntornoCrudo = Record<string, string | undefined>;

export interface ConfiguracionS3 {
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Con emuladores: crear el bucket si no existe. */
  crearBucket: boolean;
  /** Los servicios que no son AWS rechazan o calculan distinto los checksums por defecto. */
  checksumsSoloSiHaceFalta: boolean;
}

interface Preset {
  /** Variables que tiene que traer el entorno, con dónde conseguirlas. */
  requeridas: Record<string, string>;
  endpoint: (e: (n: string) => string) => string | undefined;
  region: (e: (n: string) => string) => string;
  forcePathStyle: boolean;
  emulador?: boolean;
}

const CLAVES = {
  S3_ACCESS_KEY_ID:
    'el ID de la clave de acceso S3 (se genera en el panel del proveedor)',
  S3_SECRET_ACCESS_KEY:
    'la clave secreta de acceso S3 (se muestra una sola vez al generarla)',
};

export const PRESETS_S3: Record<string, Preset> = {
  aws: {
    requeridas: {
      S3_BUCKET: 'el nombre del bucket (consola de AWS → S3)',
      S3_REGION: 'la región del bucket, por ejemplo sa-east-1',
      ...CLAVES,
    },
    endpoint: () => undefined,
    region: (e) => e('S3_REGION'),
    forcePathStyle: false,
  },
  supabase: {
    requeridas: {
      SUPABASE_PROYECTO:
        'la referencia del proyecto (Project Settings → General → Reference ID)',
      S3_BUCKET: 'el nombre del bucket (Storage → Buckets)',
      S3_REGION: 'la región del proyecto (Project Settings → S3 Connection)',
      ...CLAVES,
    },
    endpoint: (e) =>
      `https://${e('SUPABASE_PROYECTO')}.storage.supabase.co/storage/v1/s3`,
    region: (e) => e('S3_REGION'),
    forcePathStyle: true,
  },
  r2: {
    requeridas: {
      R2_CUENTA: 'el ID de tu cuenta de Cloudflare (panel de R2)',
      S3_BUCKET: 'el nombre del bucket (R2 → Buckets)',
      ...CLAVES,
    },
    endpoint: (e) => `https://${e('R2_CUENTA')}.r2.cloudflarestorage.com`,
    region: () => 'auto',
    forcePathStyle: false,
  },
  b2: {
    requeridas: {
      S3_BUCKET: 'el nombre del bucket (Backblaze → Buckets)',
      S3_REGION:
        'la región del bucket, por ejemplo us-west-004 (figura en el endpoint del bucket)',
      ...CLAVES,
    },
    endpoint: (e) => `https://s3.${e('S3_REGION')}.backblazeb2.com`,
    region: (e) => e('S3_REGION'),
    forcePathStyle: false,
  },
  s3proxy: {
    requeridas: {},
    endpoint: () => 'http://s3:8080',
    region: () => 'us-east-1',
    forcePathStyle: true,
    emulador: true,
  },
  localstack: {
    requeridas: {},
    endpoint: () => 'http://localstack:4566',
    region: () => 'us-east-1',
    forcePathStyle: true,
    emulador: true,
  },
};

/** Devuelve la configuración del cliente S3 o el mensaje (en castellano) de lo que falta. */
export function configuracionS3(
  proveedor: string,
  entorno: EntornoCrudo,
): ConfiguracionS3 | { error: string } {
  const preset = PRESETS_S3[proveedor];
  if (!preset)
    return { error: `ARCHIVOS_PROVEEDOR=${proveedor} no es un proveedor S3.` };
  const valor = (n: string): string => entorno[n]?.trim() ?? '';

  const faltan = Object.entries(preset.requeridas).filter(
    ([n]) => valor(n) === '',
  );
  if (faltan.length > 0) {
    return {
      error:
        `Con ARCHIVOS_PROVEEDOR=${proveedor} falta: ` +
        faltan.map(([n, donde]) => `${n} (${donde})`).join('; ') +
        '.',
    };
  }

  const endpoint = valor('S3_ENDPOINT') || preset.endpoint(valor);
  const forzar = valor('S3_FORZAR_PATH_STYLE');
  if (forzar !== '' && forzar !== 'true' && forzar !== 'false')
    return {
      error: `S3_FORZAR_PATH_STYLE tiene que ser "true" o "false" (vino "${forzar}").`,
    };
  if (endpoint !== undefined) {
    try {
      new URL(endpoint);
    } catch {
      return {
        error: `S3_ENDPOINT no es una dirección válida (vino "${endpoint}").`,
      };
    }
  }
  return {
    endpoint,
    region: preset.region(valor),
    forcePathStyle: forzar === '' ? preset.forcePathStyle : forzar === 'true',
    bucket: valor('S3_BUCKET') || 'archivos',
    accessKeyId:
      valor('S3_ACCESS_KEY_ID') || (preset.emulador ? 'clave-de-mentira' : ''),
    secretAccessKey:
      valor('S3_SECRET_ACCESS_KEY') ||
      (preset.emulador ? 'clave-de-mentira' : ''),
    crearBucket:
      preset.emulador === true || valor('ARCHIVOS_CREAR_BUCKET') === 'true',
    checksumsSoloSiHaceFalta: proveedor !== 'aws',
  };
}
