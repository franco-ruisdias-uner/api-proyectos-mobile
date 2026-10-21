import { configuracionS3 } from './providers.js';

const claves = { S3_ACCESS_KEY_ID: 'id', S3_SECRET_ACCESS_KEY: 'secreto' };

describe('AGENTS §17.2 — presets de proveedores de archivos', () => {
  it('aws: virtual, región del bucket, sin endpoint', () => {
    expect(
      configuracionS3('aws', {
        S3_BUCKET: 'b',
        S3_REGION: 'sa-east-1',
        ...claves,
      }),
    ).toMatchObject({
      endpoint: undefined,
      region: 'sa-east-1',
      forcePathStyle: false,
      checksumsSoloSiHaceFalta: false,
    });
  });
  it('supabase: endpoint del proyecto y ruta path', () => {
    expect(
      configuracionS3('supabase', {
        SUPABASE_PROYECTO: 'abc',
        S3_BUCKET: 'b',
        S3_REGION: 'sa-east-1',
        ...claves,
      }),
    ).toMatchObject({
      endpoint: 'https://abc.storage.supabase.co/storage/v1/s3',
      region: 'sa-east-1',
      forcePathStyle: true,
      checksumsSoloSiHaceFalta: true,
    });
  });
  it('r2: región auto', () => {
    expect(
      configuracionS3('r2', { R2_CUENTA: 'cu', S3_BUCKET: 'b', ...claves }),
    ).toMatchObject({
      endpoint: 'https://cu.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: false,
    });
  });
  it('b2: región igual a la del endpoint', () => {
    expect(
      configuracionS3('b2', {
        S3_BUCKET: 'b',
        S3_REGION: 'us-west-004',
        ...claves,
      }),
    ).toMatchObject({
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      region: 'us-west-004',
    });
  });
  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ])('%s: emulador sin variables, crea el bucket', (p, endpoint) => {
    expect(configuracionS3(p, {})).toMatchObject({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      bucket: 'archivos',
      crearBucket: true,
    });
  });
  it.each([
    [
      'aws',
      {},
      ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
    ['supabase', { S3_BUCKET: 'b' }, ['SUPABASE_PROYECTO', 'S3_REGION']],
    ['r2', claves, ['R2_CUENTA', 'S3_BUCKET']],
    ['b2', { S3_BUCKET: 'b', ...claves }, ['S3_REGION']],
  ])(
    '%s: dice qué variable falta y dónde se consigue',
    (p, entorno, faltan) => {
      const r = configuracionS3(p, entorno);
      expect('error' in r).toBe(true);
      for (const n of faltan)
        expect((r as { error: string }).error).toContain(n);
      expect((r as { error: string }).error).toContain('(');
    },
  );
  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset', () => {
    expect(
      configuracionS3('r2', {
        R2_CUENTA: 'cu',
        S3_BUCKET: 'b',
        ...claves,
        S3_ENDPOINT: 'https://otro.ejemplo.com',
        S3_FORZAR_PATH_STYLE: 'true',
      }),
    ).toMatchObject({
      endpoint: 'https://otro.ejemplo.com',
      forcePathStyle: true,
    });
  });
  it('rechaza un endpoint inválido y un booleano mal escrito', () => {
    const base = { S3_BUCKET: 'b', S3_REGION: 'x', ...claves };
    expect(
      configuracionS3('aws', { ...base, S3_ENDPOINT: 'nada' }),
    ).toHaveProperty('error');
    expect(
      configuracionS3('aws', { ...base, S3_FORZAR_PATH_STYLE: 'si' }),
    ).toHaveProperty('error');
  });
});
