import { hasS3Problems, s3ConfigFromEnv } from './providers.js';

const claves = { S3_ACCESS_KEY_ID: 'AK', S3_SECRET_ACCESS_KEY: 'SK' };

function ok(entorno: Record<string, string>) {
  const r = s3ConfigFromEnv(entorno);
  if (r === null || hasS3Problems(r)) throw new Error(JSON.stringify(r));
  return r;
}
function problemas(entorno: Record<string, string>): string[] {
  const r = s3ConfigFromEnv(entorno);
  if (r === null || !hasS3Problems(r))
    throw new Error('se esperaban problemas');
  return r.problems;
}

describe('AGENTS §17.2 — Presets de proveedores de archivos', () => {
  it('local (o sin variable) no usa S3', () => {
    expect(s3ConfigFromEnv({})).toBeNull();
    expect(s3ConfigFromEnv({ STORAGE_PROVIDER: 'local' })).toBeNull();
  });

  it('aws: endpoint del SDK, ruta virtual y región del bucket', () => {
    const c = ok({
      STORAGE_PROVIDER: 'aws',
      S3_BUCKET: 'b',
      S3_REGION: 'sa-east-1',
      ...claves,
    });
    expect(c).toMatchObject({
      endpoint: undefined,
      region: 'sa-east-1',
      forcePathStyle: false,
      bucket: 'b',
    });
  });

  it('supabase: endpoint del proyecto y ruta tipo path', () => {
    const c = ok({
      STORAGE_PROVIDER: 'supabase',
      SUPABASE_PROJECT_REF: 'abcd',
      S3_BUCKET: 'b',
      S3_REGION: 'sa-east-1',
      ...claves,
    });
    expect(c.endpoint).toBe('https://abcd.storage.supabase.co/storage/v1/s3');
    expect(c.forcePathStyle).toBe(true);
  });

  it('r2: región auto fija y endpoint de la cuenta', () => {
    const c = ok({
      STORAGE_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'c123',
      S3_BUCKET: 'b',
      ...claves,
    });
    expect(c.endpoint).toBe('https://c123.r2.cloudflarestorage.com');
    expect(c.region).toBe('auto');
    expect(c.forcePathStyle).toBe(false);
  });

  it('b2: endpoint con la región del bucket', () => {
    const c = ok({
      STORAGE_PROVIDER: 'b2',
      S3_BUCKET: 'b',
      S3_REGION: 'us-west-004',
      ...claves,
    });
    expect(c.endpoint).toBe('https://s3.us-west-004.backblazeb2.com');
  });

  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ])('%s: no pide nada, crea el bucket y usa ruta tipo path', (p, endpoint) => {
    const c = ok({ STORAGE_PROVIDER: p });
    expect(c).toMatchObject({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      bucket: 'archivos',
      createBucket: true,
    });
  });

  it('S3_ENDPOINT y S3_FORCE_PATH_STYLE pisan el preset', () => {
    const c = ok({
      STORAGE_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'c',
      S3_BUCKET: 'b',
      S3_ENDPOINT: 'https://otro.ejemplo.com',
      S3_FORCE_PATH_STYLE: 'true',
      ...claves,
    });
    expect(c.endpoint).toBe('https://otro.ejemplo.com');
    expect(c.forcePathStyle).toBe(true);
  });

  it('STORAGE_REDIRECT se lee', () => {
    expect(
      ok({ STORAGE_PROVIDER: 's3proxy', STORAGE_REDIRECT: 'true' }).redirect,
    ).toBe(true);
  });

  it('avisa qué variables faltan y dónde se consiguen', () => {
    const p = problemas({ STORAGE_PROVIDER: 'supabase' });
    expect(p.join('\n')).toContain('SUPABASE_PROJECT_REF');
    expect(p.join('\n')).toContain('S3_BUCKET');
    expect(p.join('\n')).toContain('S3_REGION');
    expect(p.join('\n')).toContain('S3_ACCESS_KEY_ID');
    expect(p.join('\n')).toContain('S3_SECRET_ACCESS_KEY');
    expect(p.join('\n')).toContain('Project Settings');
  });

  it('r2 sin cuenta, y b2 sin región', () => {
    expect(
      problemas({ STORAGE_PROVIDER: 'r2', S3_BUCKET: 'b', ...claves }).join(),
    ).toContain('R2_ACCOUNT_ID');
    expect(
      problemas({ STORAGE_PROVIDER: 'b2', S3_BUCKET: 'b', ...claves }).join(),
    ).toContain('S3_REGION');
  });

  it('un proveedor que no existe', () => {
    expect(problemas({ STORAGE_PROVIDER: 'firebase' })[0]).toContain(
      'no existe',
    );
  });
});

describe('AGENTS §17.2 — R2 tiene región fija', () => {
  it('S3_REGION no pisa "auto"', () => {
    expect(
      ok({
        STORAGE_PROVIDER: 'r2',
        R2_ACCOUNT_ID: 'c',
        S3_BUCKET: 'b',
        S3_REGION: 'eu-west-1',
        ...claves,
      }).region,
    ).toBe('auto');
  });
});
