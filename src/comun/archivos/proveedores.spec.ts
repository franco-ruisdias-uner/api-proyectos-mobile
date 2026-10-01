import { configuracionS3, type ConfiguracionS3 } from './proveedores.js';

const claves = { S3_ACCESS_KEY_ID: 'AKIA', S3_SECRET_ACCESS_KEY: 'secreto' };

function ok(resultado: ReturnType<typeof configuracionS3>): ConfiguracionS3 {
  if (!resultado.ok) throw new Error(resultado.problemas.join('\n'));
  return resultado.config;
}
const problemas = (resultado: ReturnType<typeof configuracionS3>): string[] =>
  resultado.ok ? [] : resultado.problemas;

describe('AGENTS §17.2 — presets de proveedores S3', () => {
  it('aws: endpoint de AWS, ruta virtual, con checksums del SDK', () => {
    const c = ok(
      configuracionS3('aws', { S3_BUCKET: 'mi-bucket', S3_REGION: 'sa-east-1', ...claves }),
    );
    expect(c).toMatchObject({
      endpoint: undefined,
      region: 'sa-east-1',
      forcePathStyle: false,
      bucket: 'mi-bucket',
      crearBucket: false,
      checksumsSoloSiHaceFalta: false,
    });
  });

  it('supabase: endpoint del proyecto, ruta path, región del proyecto', () => {
    const c = ok(
      configuracionS3('supabase', {
        SUPABASE_PROYECTO: 'abcdefgh',
        S3_BUCKET: 'archivos',
        S3_REGION: 'sa-east-1',
        ...claves,
      }),
    );
    expect(c).toMatchObject({
      endpoint: 'https://abcdefgh.storage.supabase.co/storage/v1/s3',
      region: 'sa-east-1',
      forcePathStyle: true,
      checksumsSoloSiHaceFalta: true,
    });
  });

  it('r2: endpoint de la cuenta y región auto fija, aunque venga otra', () => {
    const c = ok(
      configuracionS3('r2', { R2_CUENTA: 'cuenta1', S3_BUCKET: 'b', S3_REGION: 'x', ...claves }),
    );
    expect(c).toMatchObject({
      endpoint: 'https://cuenta1.r2.cloudflarestorage.com',
      region: 'auto',
      forcePathStyle: false,
    });
  });

  it('b2: el endpoint sale de la región', () => {
    const c = ok(configuracionS3('b2', { S3_BUCKET: 'b', S3_REGION: 'us-west-004', ...claves }));
    expect(c.endpoint).toBe('https://s3.us-west-004.backblazeb2.com');
    expect(c.region).toBe('us-west-004');
  });

  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ] as const)('%s: no pide nada, usa su endpoint, crea el bucket y claves de mentira', (p, url) => {
    const c = ok(configuracionS3(p, {}));
    expect(c).toMatchObject({
      endpoint: url,
      region: 'us-east-1',
      forcePathStyle: true,
      bucket: 'archivos',
      crearBucket: true,
    });
  });

  describe('variables que faltan: el mensaje dice cuál y dónde se consigue', () => {
    it('aws sin nada', () => {
      const p = problemas(configuracionS3('aws', {}));
      expect(p).toHaveLength(4);
      expect(p.join('\n')).toMatch(/S3_BUCKET.*bucket/);
      expect(p.join('\n')).toMatch(/S3_REGION/);
      expect(p.join('\n')).toMatch(/S3_ACCESS_KEY_ID/);
      expect(p.join('\n')).toMatch(/S3_SECRET_ACCESS_KEY/);
    });

    it('supabase sin proyecto', () => {
      const p = problemas(
        configuracionS3('supabase', { S3_BUCKET: 'b', S3_REGION: 'r', ...claves }),
      );
      expect(p).toHaveLength(1);
      expect(p[0]).toMatch(/SUPABASE_PROYECTO.*supabase\.co/);
    });

    it('r2 sin cuenta (no pide región)', () => {
      const p = problemas(configuracionS3('r2', { S3_BUCKET: 'b', ...claves }));
      expect(p).toHaveLength(1);
      expect(p[0]).toMatch(/R2_CUENTA/);
    });

    it('b2 sin región', () => {
      const p = problemas(configuracionS3('b2', { S3_BUCKET: 'b', ...claves }));
      expect(p).toHaveLength(1);
      expect(p[0]).toMatch(/S3_REGION/);
    });

    it('una variable vacía cuenta como faltante', () => {
      expect(
        problemas(configuracionS3('aws', { S3_BUCKET: '  ', S3_REGION: 'r', ...claves }))[0],
      ).toMatch(/S3_BUCKET/);
    });
  });

  describe('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset', () => {
    const base = { S3_BUCKET: 'b', S3_REGION: 'r', ...claves };
    it('endpoint propio, sin barra final', () => {
      const c = ok(configuracionS3('aws', { ...base, S3_ENDPOINT: 'https://s3.otro.com/' }));
      expect(c.endpoint).toBe('https://s3.otro.com');
    });
    it('path style forzado en ambos sentidos', () => {
      expect(
        ok(configuracionS3('aws', { ...base, S3_FORZAR_PATH_STYLE: 'true' })).forcePathStyle,
      ).toBe(true);
      expect(ok(configuracionS3('s3proxy', { S3_FORZAR_PATH_STYLE: 'false' })).forcePathStyle).toBe(
        false,
      );
    });
    it('rechaza un endpoint que no es http ni https', () => {
      expect(problemas(configuracionS3('aws', { ...base, S3_ENDPOINT: 'ftp://x' }))[0]).toMatch(
        /S3_ENDPOINT/,
      );
    });
    it('rechaza un valor raro de S3_FORZAR_PATH_STYLE', () => {
      expect(problemas(configuracionS3('aws', { ...base, S3_FORZAR_PATH_STYLE: 'si' }))[0]).toMatch(
        /S3_FORZAR_PATH_STYLE/,
      );
    });
    it('ARCHIVOS_CREAR_BUCKET se puede activar o apagar', () => {
      expect(
        ok(configuracionS3('aws', { ...base, ARCHIVOS_CREAR_BUCKET: 'true' })).crearBucket,
      ).toBe(true);
      expect(ok(configuracionS3('s3proxy', { ARCHIVOS_CREAR_BUCKET: 'false' })).crearBucket).toBe(
        false,
      );
      expect(problemas(configuracionS3('aws', { ...base, ARCHIVOS_CREAR_BUCKET: 'x' }))[0]).toMatch(
        /ARCHIVOS_CREAR_BUCKET/,
      );
    });
  });
});
