// Presets de proveedores de archivos (AGENTS §17.2): una tabla de datos y una función pura
// que completa endpoint, región y estilo de ruta, y valida las variables que faltan.

export const PROVEEDORES_ARCHIVOS = [
  'local',
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type ProveedorArchivos = (typeof PROVEEDORES_ARCHIVOS)[number];

export type Variables = Record<string, string | undefined>;

export interface ConfiguracionS3 {
  proveedor: Exclude<ProveedorArchivos, 'local'>;
  /** undefined: el de AWS. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Todos menos AWS: los checksums por defecto del SDK los rechazan varios servicios. */
  checksumsSoloSiHaceFalta: boolean;
  /** Emuladores: crea el bucket al arrancar. */
  crearBucket: boolean;
}

export type ResultadoS3 =
  { ok: true; config: ConfiguracionS3 } | { ok: false; problemas: string[] };

interface Preset {
  endpoint: (v: Variables) => string | undefined;
  region: string | null; // null: la pide el usuario en S3_REGION
  forcePathStyle: boolean;
  emulador: boolean;
  /** Variables propias del proveedor, con dónde se consiguen. */
  requeridas: { nombre: string; donde: string }[];
}

const CLAVES = [
  {
    nombre: 'S3_ACCESS_KEY_ID',
    donde: 'se genera en el panel del proveedor (claves de acceso S3)',
  },
  {
    nombre: 'S3_SECRET_ACCESS_KEY',
    donde: 'se muestra una sola vez al generar la clave de acceso',
  },
];
const BUCKET = {
  nombre: 'S3_BUCKET',
  donde: 'el nombre del bucket que creaste en el panel del proveedor',
};
const REGION = {
  nombre: 'S3_REGION',
  donde: 'la región del bucket, que figura en el panel del proveedor',
};

export const PRESETS: Record<Exclude<ProveedorArchivos, 'local'>, Preset> = {
  aws: {
    endpoint: () => undefined,
    region: null,
    forcePathStyle: false,
    emulador: false,
    requeridas: [BUCKET, REGION, ...CLAVES],
  },
  supabase: {
    endpoint: (v) =>
      `https://${v.SUPABASE_PROYECTO}.storage.supabase.co/storage/v1/s3`,
    region: null,
    forcePathStyle: true,
    emulador: false,
    requeridas: [
      {
        nombre: 'SUPABASE_PROYECTO',
        donde:
          'la referencia del proyecto: Supabase → Project Settings → General → Reference ID',
      },
      BUCKET,
      REGION,
      ...CLAVES,
    ],
  },
  r2: {
    endpoint: (v) => `https://${v.R2_CUENTA}.r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: false,
    emulador: false,
    requeridas: [
      {
        nombre: 'R2_CUENTA',
        donde: 'el Account ID de Cloudflare (panel de R2, a la derecha)',
      },
      BUCKET,
      ...CLAVES,
    ],
  },
  b2: {
    endpoint: (v) => `https://s3.${v.S3_REGION}.backblazeb2.com`,
    region: null,
    forcePathStyle: false,
    emulador: false,
    requeridas: [
      BUCKET,
      {
        nombre: 'S3_REGION',
        donde:
          'la región del bucket en Backblaze B2, por ejemplo us-west-004 (figura en su endpoint)',
      },
      ...CLAVES,
    ],
  },
  s3proxy: {
    endpoint: () => 'http://s3:8080',
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: true,
    requeridas: [],
  },
  localstack: {
    endpoint: () => 'http://localstack:4566',
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: true,
    requeridas: [],
  },
};

const vacio = (valor: string | undefined): boolean =>
  valor === undefined || valor.trim() === '';

const esProveedor = (valor: string): valor is ProveedorArchivos =>
  (PROVEEDORES_ARCHIVOS as readonly string[]).includes(valor);

/** Interpreta un booleano de entorno; undefined si no está o no se entiende. */
const booleano = (valor: string | undefined): boolean | undefined => {
  if (vacio(valor)) return undefined;
  const v = valor!.trim().toLowerCase();
  if (['true', '1', 'si', 'sí'].includes(v)) return true;
  if (['false', '0', 'no'].includes(v)) return false;
  return undefined;
};

/**
 * Configuración del cliente S3 para el proveedor elegido, o los problemas (en castellano, con
 * qué variable falta y dónde se consigue). S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset.
 */
export function configuracionS3(entorno: Variables): ResultadoS3 {
  const proveedor = entorno.ARCHIVOS_PROVEEDOR?.trim() || 'local';
  if (!esProveedor(proveedor)) {
    return {
      ok: false,
      problemas: [
        `ARCHIVOS_PROVEEDOR tiene que ser uno de: ${PROVEEDORES_ARCHIVOS.join(', ')} (vino "${proveedor}").`,
      ],
    };
  }
  if (proveedor === 'local') {
    return {
      ok: false,
      problemas: ['ARCHIVOS_PROVEEDOR=local guarda en disco: no usa S3.'],
    };
  }

  const preset = PRESETS[proveedor];
  const problemas = preset.requeridas
    .filter((r) => vacio(entorno[r.nombre]))
    .map(
      (r) =>
        `Con ARCHIVOS_PROVEEDOR=${proveedor} falta ${r.nombre}: ${r.donde}.`,
    );
  if (problemas.length > 0) return { ok: false, problemas };

  const v: Variables = Object.fromEntries(
    Object.entries(entorno).map(([k, valor]) => [k, valor?.trim()]),
  );
  const forzar = booleano(v.S3_FORZAR_PATH_STYLE);
  if (!vacio(v.S3_FORZAR_PATH_STYLE) && forzar === undefined) {
    return {
      ok: false,
      problemas: ['S3_FORZAR_PATH_STYLE tiene que ser true o false.'],
    };
  }
  const endpoint = vacio(v.S3_ENDPOINT) ? preset.endpoint(v) : v.S3_ENDPOINT;

  return {
    ok: true,
    config: {
      proveedor,
      endpoint,
      region: preset.region ?? v.S3_REGION!,
      forcePathStyle: forzar ?? preset.forcePathStyle,
      bucket: vacio(v.S3_BUCKET) ? 'archivos' : v.S3_BUCKET!,
      accessKeyId: vacio(v.S3_ACCESS_KEY_ID)
        ? 'clave-de-mentira'
        : v.S3_ACCESS_KEY_ID!,
      secretAccessKey: vacio(v.S3_SECRET_ACCESS_KEY)
        ? 'clave-de-mentira'
        : v.S3_SECRET_ACCESS_KEY!,
      checksumsSoloSiHaceFalta: proveedor !== 'aws',
      crearBucket:
        preset.emulador && booleano(v.ARCHIVOS_CREAR_BUCKET) !== false,
    },
  };
}
