/**
 * Proveedores de archivos (AGENTS §17.2). Todos los de la nube hablan el protocolo de S3:
 * no hay un adaptador por proveedor sino un preset que completa endpoint, región y estilo de ruta.
 */
export const PROVEEDORES_ARCHIVOS = [
  'local',
  'aws',
  'supabase',
  'r2',
  'b2',
  's3proxy',
  'localstack',
] as const;
export type ProveedorArchivosConfigurado = (typeof PROVEEDORES_ARCHIVOS)[number];

export interface ConfiguracionS3 {
  proveedor: Exclude<ProveedorArchivosConfigurado, 'local'>;
  /** `undefined` en AWS: el SDK resuelve el endpoint según la región. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Sólo los emuladores: crear el bucket al arrancar si no existe. */
  crearBucket: boolean;
  /** AWS no necesita el ajuste de checksums; el resto sí (secc. 17.2). */
  checksumsSoloSiHaceFalta: boolean;
}

export type ResultadoS3 = { config: ConfiguracionS3 } | { errores: string[] };

interface Preset {
  /** Variables propias del proveedor (además de bucket, región y claves). */
  propias: { nombre: string; dondeConseguirla: string }[];
  region: 'variable' | string;
  endpoint: (v: (n: string) => string) => string | undefined;
  pathStyle: boolean;
  emulador: boolean;
  /** Para los emuladores, todo tiene un valor por defecto. */
  pideClaves: boolean;
  pideBucket: boolean;
}

export const PRESETS_S3: Record<Exclude<ProveedorArchivosConfigurado, 'local'>, Preset> = {
  aws: {
    propias: [],
    region: 'variable',
    endpoint: () => undefined,
    pathStyle: false,
    emulador: false,
    pideClaves: true,
    pideBucket: true,
  },
  supabase: {
    propias: [
      {
        nombre: 'SUPABASE_PROYECTO',
        dondeConseguirla:
          'es el identificador del proyecto: la parte de la dirección del panel que va después de /project/',
      },
    ],
    region: 'variable',
    endpoint: (v) => `https://${v('SUPABASE_PROYECTO')}.storage.supabase.co/storage/v1/s3`,
    pathStyle: true,
    emulador: false,
    pideClaves: true,
    pideBucket: true,
  },
  r2: {
    propias: [
      {
        nombre: 'R2_CUENTA',
        dondeConseguirla: 'es el «Account ID» de Cloudflare, en la página de R2 del panel',
      },
    ],
    region: 'auto',
    endpoint: (v) => `https://${v('R2_CUENTA')}.r2.cloudflarestorage.com`,
    pathStyle: false,
    emulador: false,
    pideClaves: true,
    pideBucket: true,
  },
  b2: {
    propias: [],
    region: 'variable',
    endpoint: (v) => `https://s3.${v('S3_REGION')}.backblazeb2.com`,
    pathStyle: false,
    emulador: false,
    pideClaves: true,
    pideBucket: true,
  },
  s3proxy: {
    propias: [],
    region: 'us-east-1',
    endpoint: () => 'http://s3:8080',
    pathStyle: true,
    emulador: true,
    pideClaves: false,
    pideBucket: false,
  },
  localstack: {
    propias: [],
    region: 'us-east-1',
    endpoint: () => 'http://localstack:4566',
    pathStyle: true,
    emulador: true,
    pideClaves: false,
    pideBucket: false,
  },
};

const DONDE: Record<string, string> = {
  S3_BUCKET: 'es el nombre del bucket que creaste en el panel del proveedor',
  S3_REGION: 'está en el panel del proveedor, junto al bucket',
  S3_ACCESS_KEY_ID: 'se genera en el panel del proveedor (claves de acceso S3)',
  S3_SECRET_ACCESS_KEY: 'se muestra una sola vez al generar la clave de acceso S3',
};

/**
 * Función pura: de las variables de entorno a la configuración del cliente S3, o a la lista de
 * problemas en castellano (qué variable falta y dónde se consigue).
 */
export function configuracionS3(variables: Record<string, unknown>): ResultadoS3 {
  const texto = (n: string): string | undefined => {
    const v = variables[n];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
  };
  const proveedor = texto('ARCHIVOS_PROVEEDOR') ?? 'local';
  if (proveedor === 'local' || !(proveedor in PRESETS_S3)) {
    return { errores: [`ARCHIVOS_PROVEEDOR=${proveedor} no usa S3.`] };
  }
  const nombre = proveedor as keyof typeof PRESETS_S3;
  const preset = PRESETS_S3[nombre];
  const errores: string[] = [];
  const falta = (variable: string, donde: string) =>
    errores.push(`Falta ${variable} (ARCHIVOS_PROVEEDOR=${nombre}): ${donde}.`);

  for (const p of preset.propias) if (!texto(p.nombre)) falta(p.nombre, p.dondeConseguirla);
  if (preset.pideBucket && !texto('S3_BUCKET')) falta('S3_BUCKET', DONDE.S3_BUCKET);
  if (preset.region === 'variable' && !texto('S3_REGION')) falta('S3_REGION', DONDE.S3_REGION);
  if (preset.pideClaves) {
    if (!texto('S3_ACCESS_KEY_ID')) falta('S3_ACCESS_KEY_ID', DONDE.S3_ACCESS_KEY_ID);
    if (!texto('S3_SECRET_ACCESS_KEY')) falta('S3_SECRET_ACCESS_KEY', DONDE.S3_SECRET_ACCESS_KEY);
  }

  let endpointForzado: string | undefined;
  const e = texto('S3_ENDPOINT');
  if (e !== undefined) {
    try {
      new URL(e);
      endpointForzado = e;
    } catch {
      errores.push(`S3_ENDPOINT vale "${e}", que no es una dirección válida.`);
    }
  }
  let pathForzado: boolean | undefined;
  const p = texto('S3_FORZAR_PATH_STYLE');
  if (p !== undefined) {
    if (p === 'true' || p === 'false') pathForzado = p === 'true';
    else errores.push(`S3_FORZAR_PATH_STYLE vale "${p}", pero tiene que ser "true" o "false".`);
  }

  if (errores.length > 0) return { errores };

  const v = (n: string) => texto(n) ?? '';
  return {
    config: {
      proveedor: nombre,
      endpoint: endpointForzado ?? preset.endpoint(v),
      region: preset.region === 'variable' ? v('S3_REGION') : preset.region,
      forcePathStyle: pathForzado ?? preset.pathStyle,
      bucket: texto('S3_BUCKET') ?? 'archivos',
      accessKeyId: texto('S3_ACCESS_KEY_ID') ?? 'clave-de-mentira',
      secretAccessKey: texto('S3_SECRET_ACCESS_KEY') ?? 'clave-de-mentira',
      crearBucket: texto('ARCHIVOS_CREAR_BUCKET') === 'true' || preset.emulador,
      checksumsSoloSiHaceFalta: nombre !== 'aws',
    },
  };
}
