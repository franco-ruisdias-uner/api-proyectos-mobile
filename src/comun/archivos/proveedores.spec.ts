import { configuracionS3 } from './proveedores.js';

const claves = { S3_ACCESS_KEY_ID: 'AK', S3_SECRET_ACCESS_KEY: 'SK' };

describe('AGENTS §17.2 — configuracionS3: un preset por proveedor', () => {
  it('aws: endpoint del SDK, ruta virtual, región y bucket del usuario', () => {
    expect(
      configuracionS3({
        ARCHIVOS_PROVEEDOR: 'aws',
        S3_BUCKET: 'b',
        S3_REGION: 'sa-east-1',
        ...claves,
      }),
    ).toEqual({
      config: expect.objectContaining({
        endpoint: undefined,
        region: 'sa-east-1',
        forcePathStyle: false,
        bucket: 'b',
        checksumsSoloSiHaceFalta: false,
        crearBucket: false,
      }),
    });
  });

  it('supabase: endpoint del proyecto y ruta tipo path', () => {
    const r = configuracionS3({
      ARCHIVOS_PROVEEDOR: 'supabase',
      SUPABASE_PROYECTO: 'abcd1234',
      S3_BUCKET: 'archivos',
      S3_REGION: 'us-east-2',
      ...claves,
    });
    expect(r).toEqual({
      config: expect.objectContaining({
        endpoint: 'https://abcd1234.storage.supabase.co/storage/v1/s3',
        region: 'us-east-2',
        forcePathStyle: true,
        checksumsSoloSiHaceFalta: true,
      }),
    });
  });

  it('r2: región fija «auto» y endpoint de la cuenta', () => {
    expect(
      configuracionS3({
        ARCHIVOS_PROVEEDOR: 'r2',
        R2_CUENTA: 'cuenta1',
        S3_BUCKET: 'b',
        ...claves,
      }),
    ).toEqual({
      config: expect.objectContaining({
        endpoint: 'https://cuenta1.r2.cloudflarestorage.com',
        region: 'auto',
        forcePathStyle: false,
      }),
    });
  });

  it('b2: el endpoint sale de la región', () => {
    expect(
      configuracionS3({
        ARCHIVOS_PROVEEDOR: 'b2',
        S3_BUCKET: 'b',
        S3_REGION: 'us-west-004',
        ...claves,
      }),
    ).toEqual({
      config: expect.objectContaining({
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
        region: 'us-west-004',
      }),
    });
  });

  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ])('%s: no pide nada, crea el bucket y usa ruta tipo path', (proveedor, endpoint) => {
    expect(configuracionS3({ ARCHIVOS_PROVEEDOR: proveedor })).toEqual({
      config: expect.objectContaining({
        endpoint,
        region: 'us-east-1',
        forcePathStyle: true,
        bucket: 'archivos',
        crearBucket: true,
      }),
    });
  });

  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan al preset', () => {
    const r = configuracionS3({
      ARCHIVOS_PROVEEDOR: 'r2',
      R2_CUENTA: 'c',
      S3_BUCKET: 'b',
      S3_ENDPOINT: 'https://minio.local:9000',
      S3_FORZAR_PATH_STYLE: 'true',
      ...claves,
    });
    expect(r).toEqual({
      config: expect.objectContaining({
        endpoint: 'https://minio.local:9000',
        forcePathStyle: true,
      }),
    });
  });

  it.each([
    [
      { ARCHIVOS_PROVEEDOR: 'aws' },
      ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
    [
      { ARCHIVOS_PROVEEDOR: 'supabase', ...claves },
      ['SUPABASE_PROYECTO', 'S3_BUCKET', 'S3_REGION'],
    ],
    [{ ARCHIVOS_PROVEEDOR: 'r2', S3_BUCKET: 'b', ...claves }, ['R2_CUENTA']],
    [{ ARCHIVOS_PROVEEDOR: 'b2', S3_BUCKET: 'b', ...claves }, ['S3_REGION']],
  ])('%j: dice qué variables faltan y dónde se consiguen', (variables, faltan) => {
    const r = configuracionS3(variables);
    if (!('errores' in r)) throw new Error('tendría que fallar');
    for (const nombre of faltan) expect(r.errores.join('\n')).toContain(`Falta ${nombre}`);
    expect(r.errores.join('\n')).toMatch(/panel|bucket|identificador|Account ID/);
    expect(r.errores).toHaveLength(faltan.length);
  });

  it('un S3_ENDPOINT o un S3_FORZAR_PATH_STYLE mal escritos se reportan', () => {
    const r = configuracionS3({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'mi-minio',
      S3_FORZAR_PATH_STYLE: 'si',
    });
    expect(r).toEqual({
      errores: [
        expect.stringContaining('S3_ENDPOINT'),
        expect.stringContaining('S3_FORZAR_PATH_STYLE'),
      ],
    });
  });
});
