/**
 * Presets de proveedores de archivos (AGENTS §17.2). Todos los servicios en la nube que
 * soportamos hablan el protocolo de S3: no hay un adaptador por proveedor, hay un preset que
 * completa endpoint, región y estilo de ruta, y valida que estén las variables que hacen falta.
 * Función pura: sin entorno del proceso ni red.
 */

export const PROVEEDORES_S3 = ['aws', 'supabase', 'r2', 'b2', 's3proxy', 'localstack'] as const;
export type ProveedorS3 = (typeof PROVEEDORES_S3)[number];
export const PROVEEDORES_ARCHIVOS = ['local', ...PROVEEDORES_S3] as const;
export type ProveedorArchivosElegido = (typeof PROVEEDORES_ARCHIVOS)[number];

type Crudo = Record<string, string | undefined>;

interface PresetS3 {
  /** Variables propias del proveedor, además de `S3_BUCKET` y las claves. */
  variables: { nombre: string; donde: string }[];
  endpoint(e: Crudo): string | undefined;
  /** `null`: hay que pedirla en `S3_REGION`. */
  region: string | null;
  forcePathStyle: boolean;
  /** Emuladores locales: no piden cuenta ni claves reales. */
  emulador?: { endpoint: string; bucket: string };
  ayudaBucket: string;
  ayudaClaves: string;
}

const REGION_AYUDA = (donde: string) => `S3_REGION es la región del bucket (${donde}).`;

/** La tabla de presets: agregar un proveedor es agregar una fila. */
export const PRESETS_S3: Record<ProveedorS3, PresetS3> = {
  aws: {
    variables: [],
    endpoint: () => undefined,
    region: null,
    forcePathStyle: false,
    ayudaBucket: 'Se crea en la consola de AWS → S3 → «Crear bucket».',
    ayudaClaves:
      'Se crean en la consola de AWS → IAM → Usuarios → «Credenciales de seguridad» → «Crear clave de acceso».',
  },
  supabase: {
    variables: [
      {
        nombre: 'SUPABASE_PROYECTO',
        donde:
          'el código del proyecto: está en la URL del panel (https://supabase.com/dashboard/project/<código>)',
      },
    ],
    endpoint: (e) => `https://${e.SUPABASE_PROYECTO?.trim()}.storage.supabase.co/storage/v1/s3`,
    region: null,
    forcePathStyle: true,
    ayudaBucket: 'Se crea en Supabase → Storage → «New bucket».',
    ayudaClaves:
      'Se generan en Supabase → Storage → Settings → «S3 Connection» → «New access key». Sólo del lado del servidor: saltean las políticas de seguridad.',
  },
  r2: {
    variables: [
      {
        nombre: 'R2_CUENTA',
        donde: 'el ID de cuenta de Cloudflare: está en el panel de R2, arriba a la derecha',
      },
    ],
    endpoint: (e) => `https://${e.R2_CUENTA?.trim()}.r2.cloudflarestorage.com`,
    region: 'auto',
    forcePathStyle: false,
    ayudaBucket: 'Se crea en Cloudflare → R2 → «Create bucket».',
    ayudaClaves:
      'Se crean en Cloudflare → R2 → «Manage API tokens» → «Create API token» (permiso de lectura y escritura).',
  },
  b2: {
    variables: [],
    endpoint: (e) => `https://s3.${e.S3_REGION?.trim()}.backblazeb2.com`,
    region: null,
    forcePathStyle: false,
    ayudaBucket: 'Se crea en Backblaze → B2 Cloud Storage → «Create a Bucket».',
    ayudaClaves:
      'Se crean en Backblaze → Application Keys → «Add a New Application Key» (keyID es la clave de acceso y applicationKey el secreto).',
  },
  s3proxy: {
    variables: [],
    endpoint: () => 'http://s3:8080',
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: { endpoint: 'http://s3:8080', bucket: 'archivos' },
    ayudaBucket: '',
    ayudaClaves: '',
  },
  localstack: {
    variables: [],
    endpoint: () => 'http://localstack:4566',
    region: 'us-east-1',
    forcePathStyle: true,
    emulador: { endpoint: 'http://localstack:4566', bucket: 'archivos' },
    ayudaBucket: '',
    ayudaClaves: '',
  },
};

export interface ConfiguracionS3 {
  proveedor: ProveedorS3;
  /** `undefined`: el de AWS. */
  endpoint: string | undefined;
  region: string;
  forcePathStyle: boolean;
  bucket: string;
  credenciales: { accessKeyId: string; secretAccessKey: string };
  /** Emuladores: crear el bucket al arrancar si no existe. */
  crearBucket: boolean;
  /** Fuera de AWS los *checksums* por defecto del SDK los rechazan o los calculan distinto. */
  checksumsSoloSiHacenFalta: boolean;
  /** Responder 302 a una URL firmada en vez de pasar el archivo por la API. */
  redirigir: boolean;
}

export type ResultadoS3 = ConfiguracionS3 | { error: string };

const texto = (e: Crudo, nombre: string): string | undefined => {
  const valor = e[nombre]?.trim();
  return valor === '' ? undefined : valor;
};

function booleano(e: Crudo, nombre: string): boolean | { error: string } | undefined {
  const valor = texto(e, nombre);
  if (valor === undefined) return undefined;
  if (['true', '1', 'si', 'sí'].includes(valor.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(valor.toLowerCase())) return false;
  return { error: `${nombre} tiene que ser "true" o "false" (dice "${valor}").` };
}

const NOMBRE_BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/**
 * Devuelve la configuración del cliente S3 para `proveedor`, o `{ error }` con todo lo que falta,
 * en castellano y diciendo dónde se consigue cada dato.
 */
export function configuracionS3(proveedor: ProveedorS3, e: Crudo): ResultadoS3 {
  const preset = PRESETS_S3[proveedor];
  const problemas: string[] = [];
  const endpointPropio = texto(e, 'S3_ENDPOINT');

  for (const { nombre, donde } of preset.variables) {
    if (!texto(e, nombre) && !endpointPropio) {
      problemas.push(`Falta ${nombre}: es ${donde}.`);
    }
  }

  const bucket = texto(e, 'S3_BUCKET') ?? preset.emulador?.bucket;
  if (!bucket) {
    problemas.push(`Falta S3_BUCKET: es el nombre del bucket. ${preset.ayudaBucket}`.trim());
  } else if (!NOMBRE_BUCKET.test(bucket)) {
    problemas.push(
      `S3_BUCKET no es un nombre válido (dice "${bucket}"): usá minúsculas, números, puntos y guiones, de 3 a 63 caracteres.`,
    );
  }

  const region = texto(e, 'S3_REGION') ?? preset.region ?? undefined;
  if (!region) {
    problemas.push(
      `Falta S3_REGION: ${REGION_AYUDA(
        proveedor === 'aws'
          ? 'p. ej. us-east-1'
          : proveedor === 'b2'
            ? 'p. ej. us-west-004; está en el endpoint del bucket'
            : 'la que figura en el panel del proyecto',
      )}`,
    );
  }

  let accessKeyId = texto(e, 'S3_ACCESS_KEY_ID');
  let secretAccessKey = texto(e, 'S3_SECRET_ACCESS_KEY');
  if (preset.emulador) {
    // Los emuladores no validan las claves: de mentira, y nunca claves reales.
    accessKeyId ??= 'clave-de-mentira';
    secretAccessKey ??= 'secreto-de-mentira';
  } else {
    if (!accessKeyId) problemas.push(`Falta S3_ACCESS_KEY_ID. ${preset.ayudaClaves}`);
    if (!secretAccessKey) problemas.push(`Falta S3_SECRET_ACCESS_KEY. ${preset.ayudaClaves}`);
  }

  let endpoint = endpointPropio ?? preset.endpoint(e);
  if (endpointPropio) {
    try {
      const url = new URL(endpointPropio);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocolo');
    } catch {
      problemas.push(
        `S3_ENDPOINT tiene que ser una dirección como https://s3.ejemplo.com (dice "${endpointPropio}").`,
      );
      endpoint = undefined;
    }
  }

  const path = booleano(e, 'S3_FORZAR_PATH_STYLE');
  const crear = booleano(e, 'ARCHIVOS_CREAR_BUCKET');
  const redirigir = booleano(e, 'ARCHIVOS_REDIRIGIR');
  for (const valor of [path, crear, redirigir]) {
    if (typeof valor === 'object') problemas.push(valor.error);
  }
  if (redirigir === true && preset.emulador) {
    problemas.push(
      'ARCHIVOS_REDIRIGIR no se puede usar con un emulador: la URL firmada apuntaría a un host que el teléfono no ve.',
    );
  }

  if (problemas.length > 0) {
    return { error: `Con ARCHIVOS_PROVEEDOR=${proveedor}:\n    · ${problemas.join('\n    · ')}` };
  }
  return {
    proveedor,
    endpoint,
    region: region!,
    forcePathStyle: typeof path === 'boolean' ? path : preset.forcePathStyle,
    bucket: bucket!,
    credenciales: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    crearBucket: typeof crear === 'boolean' ? crear : preset.emulador !== undefined,
    checksumsSoloSiHacenFalta: proveedor !== 'aws',
    redirigir: redirigir === true,
  };
}
