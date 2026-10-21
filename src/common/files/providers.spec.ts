import { configuracionS3, type Variables } from './providers.js';

const claves = { S3_ACCESS_KEY_ID: 'AK', S3_SECRET_ACCESS_KEY: 'SK' };

const ok = (entorno: Variables) => {
  const r = configuracionS3(entorno);
  if (!r.ok) throw new Error(r.problemas.join(' | '));
  return r.config;
};
const problemas = (entorno: Variables) => {
  const r = configuracionS3(entorno);
  if (r.ok) throw new Error('se esperaba un error');
  return r.problemas.join(' | ');
};

describe('AGENTS §17.2 — Presets de proveedores de archivos', () => {
  it('aws: endpoint el de AWS, ruta virtual y checksums por defecto', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 'aws',
      S3_BUCKET: 'b',
      S3_REGION: 'sa-east-1',
      ...claves,
    });
    expect(c).toMatchObject({
      endpoint: undefined,
      region: 'sa-east-1',
      forcePathStyle: false,
      checksumsSoloSiHaceFalta: false,
      crearBucket: false,
    });
  });

  it('supabase: endpoint del proyecto, ruta por path, región del proyecto', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 'supabase',
      SUPABASE_PROYECTO: 'abcd',
      S3_BUCKET: 'b',
      S3_REGION: 'us-east-2',
      ...claves,
    });
    expect(c).toMatchObject({
      endpoint: 'https://abcd.storage.supabase.co/storage/v1/s3',
      region: 'us-east-2',
      forcePathStyle: true,
      checksumsSoloSiHaceFalta: true,
    });
  });

  it('r2: región auto fija y endpoint de la cuenta', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 'r2',
      R2_CUENTA: 'cuenta1',
      S3_BUCKET: 'b',
      S3_REGION: 'ignorada',
      ...claves,
    });
    expect(c).toMatchObject({
      endpoint: 'https://cuenta1.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: false,
    });
  });

  it('b2: el endpoint sale de la región del bucket', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 'b2',
      S3_BUCKET: 'b',
      S3_REGION: 'us-west-004',
      ...claves,
    });
    expect(c.endpoint).toBe('https://s3.us-west-004.backblazeb2.com');
    expect(c.region).toBe('us-west-004');
  });

  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ])('%s: no pide nada y crea el bucket', (proveedor, endpoint) => {
    const c = ok({ ARCHIVOS_PROVEEDOR: proveedor });
    expect(c).toMatchObject({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      bucket: 'archivos',
      crearBucket: true,
    });
  });

  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://127.0.0.1:58080',
      S3_FORZAR_PATH_STYLE: 'false',
    });
    expect(c).toMatchObject({
      endpoint: 'http://127.0.0.1:58080',
      forcePathStyle: false,
    });
  });

  it.each([
    [
      'aws sin nada',
      { ARCHIVOS_PROVEEDOR: 'aws' },
      /S3_BUCKET.*S3_REGION.*S3_ACCESS_KEY_ID.*S3_SECRET_ACCESS_KEY/,
    ],
    [
      'supabase sin proyecto',
      {
        ARCHIVOS_PROVEEDOR: 'supabase',
        S3_BUCKET: 'b',
        S3_REGION: 'r',
        ...claves,
      },
      /falta SUPABASE_PROYECTO: .*Reference ID/,
    ],
    [
      'r2 sin cuenta',
      { ARCHIVOS_PROVEEDOR: 'r2', S3_BUCKET: 'b', ...claves },
      /falta R2_CUENTA: .*Account ID/,
    ],
    [
      'b2 sin región',
      { ARCHIVOS_PROVEEDOR: 'b2', S3_BUCKET: 'b', ...claves },
      /falta S3_REGION: .*us-west-004/,
    ],
    [
      'proveedor desconocido',
      { ARCHIVOS_PROVEEDOR: 'dropbox' },
      /ARCHIVOS_PROVEEDOR tiene que ser uno de/,
    ],
    [
      'path style ilegible',
      { ARCHIVOS_PROVEEDOR: 's3proxy', S3_FORZAR_PATH_STYLE: 'quizas' },
      /S3_FORZAR_PATH_STYLE/,
    ],
  ])('%s → dice qué falta y dónde se consigue', (_caso, entorno, patron) => {
    expect(problemas(entorno)).toMatch(patron);
  });
});
