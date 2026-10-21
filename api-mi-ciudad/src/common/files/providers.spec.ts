import { configuracionS3, type ConfiguracionS3 } from './providers.js';

const claves = { S3_ACCESS_KEY_ID: 'AKIAEJEMPLO', S3_SECRET_ACCESS_KEY: 'secreto-de-ejemplo' };

function ok(resultado: ReturnType<typeof configuracionS3>): ConfiguracionS3 {
  if ('error' in resultado) throw new Error(`Se esperaba una configuración y dio: ${resultado.error}`);
  return resultado;
}
function error(resultado: ReturnType<typeof configuracionS3>): string {
  if (!('error' in resultado)) throw new Error('Se esperaba un error');
  return resultado.error;
}

describe('AGENTS §17.2 — Presets de proveedores de archivos', () => {
  it('aws: endpoint de AWS, ruta virtual y checksums por defecto', () => {
    const c = ok(configuracionS3('aws', { ...claves, S3_BUCKET: 'mi-ciudad', S3_REGION: 'sa-east-1' }));
    expect(c).toMatchObject({
      proveedor: 'aws',
      endpoint: undefined,
      region: 'sa-east-1',
      forcePathStyle: false,
      bucket: 'mi-ciudad',
      crearBucket: false,
      checksumsSoloSiHacenFalta: false,
      redirigir: false,
    });
  });

  it('supabase: endpoint del proyecto, ruta tipo path y checksums sólo si hacen falta', () => {
    const c = ok(
      configuracionS3('supabase', {
        ...claves,
        SUPABASE_PROYECTO: 'abcdefghij',
        S3_BUCKET: 'archivos',
        S3_REGION: 'sa-east-1',
      }),
    );
    expect(c.endpoint).toBe('https://abcdefghij.storage.supabase.co/storage/v1/s3');
    expect(c.forcePathStyle).toBe(true);
    expect(c.region).toBe('sa-east-1');
    expect(c.checksumsSoloSiHacenFalta).toBe(true);
  });

  it('r2: endpoint de la cuenta y región auto (fija)', () => {
    const c = ok(
      configuracionS3('r2', {
        ...claves,
        R2_CUENTA: '0123abcd',
        S3_BUCKET: 'archivos',
        S3_REGION: 'lo-que-sea',
      }),
    );
    expect(c.endpoint).toBe('https://0123abcd.r2.cloudflarestorage.com');
    expect(c.forcePathStyle).toBe(false);
    expect(c.checksumsSoloSiHacenFalta).toBe(true);
  });

  it('r2: la región no hace falta (es auto)', () => {
    expect(
      ok(configuracionS3('r2', { ...claves, R2_CUENTA: '0123abcd', S3_BUCKET: 'archivos' })).region,
    ).toBe('auto');
  });

  it('b2: el endpoint sale de la región', () => {
    const c = ok(configuracionS3('b2', { ...claves, S3_BUCKET: 'archivos', S3_REGION: 'us-west-004' }));
    expect(c.endpoint).toBe('https://s3.us-west-004.backblazeb2.com');
    expect(c.region).toBe('us-west-004');
  });

  it.each([
    ['s3proxy', 'http://s3:8080'],
    ['localstack', 'http://localstack:4566'],
  ] as const)(
    '%s: emulador, sin variables, con claves de mentira y crea el bucket',
    (proveedor, endpoint) => {
      const c = ok(configuracionS3(proveedor, {}));
      expect(c).toMatchObject({
        endpoint,
        region: 'us-east-1',
        forcePathStyle: true,
        bucket: 'archivos',
        crearBucket: true,
        checksumsSoloSiHacenFalta: true,
      });
      expect(c.credenciales.accessKeyId).toContain('mentira');
    },
  );

  describe('variables que faltan (dicen cuál y dónde se consigue)', () => {
    it('aws sin nada', () => {
      const e = error(configuracionS3('aws', {}));
      expect(e).toContain('ARCHIVOS_PROVEEDOR=aws');
      expect(e).toMatch(/Falta S3_BUCKET.*consola de AWS/);
      expect(e).toMatch(/Falta S3_REGION/);
      expect(e).toMatch(/Falta S3_ACCESS_KEY_ID.*IAM/);
      expect(e).toMatch(/Falta S3_SECRET_ACCESS_KEY/);
    });
    it('supabase sin el proyecto', () => {
      const e = error(
        configuracionS3('supabase', { ...claves, S3_BUCKET: 'archivos', S3_REGION: 'sa-east-1' }),
      );
      expect(e).toMatch(/Falta SUPABASE_PROYECTO.*dashboard\/project/);
    });
    it('supabase sin claves: dice que se generan en «S3 Connection»', () => {
      const e = error(
        configuracionS3('supabase', {
          SUPABASE_PROYECTO: 'abc',
          S3_BUCKET: 'archivos',
          S3_REGION: 'sa-east-1',
        }),
      );
      expect(e).toMatch(/Falta S3_ACCESS_KEY_ID.*S3 Connection/);
    });
    it('r2 sin la cuenta', () => {
      expect(error(configuracionS3('r2', { ...claves, S3_BUCKET: 'archivos' }))).toMatch(/Falta R2_CUENTA/);
    });
    it('b2 sin región', () => {
      const e = error(configuracionS3('b2', { ...claves, S3_BUCKET: 'archivos' }));
      expect(e).toMatch(/Falta S3_REGION.*us-west-004/);
    });
    it('un valor en blanco cuenta como faltante', () => {
      expect(error(configuracionS3('aws', { ...claves, S3_BUCKET: '  ', S3_REGION: 'x' }))).toMatch(
        /Falta S3_BUCKET/,
      );
    });
  });

  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan al preset', () => {
    const c = ok(
      configuracionS3('aws', {
        ...claves,
        S3_BUCKET: 'archivos',
        S3_REGION: 'us-east-1',
        S3_ENDPOINT: 'https://minio.ejemplo.com',
        S3_FORZAR_PATH_STYLE: 'true',
      }),
    );
    expect(c.endpoint).toBe('https://minio.ejemplo.com');
    expect(c.forcePathStyle).toBe(true);
    expect(
      ok(
        configuracionS3('supabase', {
          ...claves,
          S3_BUCKET: 'archivos',
          S3_REGION: 'x',
          S3_ENDPOINT: 'http://a:1',
          S3_FORZAR_PATH_STYLE: 'false',
        }),
      ).forcePathStyle,
    ).toBe(false);
  });

  it('con S3_ENDPOINT propio no hace falta SUPABASE_PROYECTO', () => {
    expect(
      'error' in
        configuracionS3('supabase', {
          ...claves,
          S3_BUCKET: 'archivos',
          S3_REGION: 'x',
          S3_ENDPOINT: 'http://a:1',
        }),
    ).toBe(false);
  });

  it('S3_ENDPOINT mal formado', () => {
    const e = error(
      configuracionS3('aws', { ...claves, S3_BUCKET: 'archivos', S3_REGION: 'x', S3_ENDPOINT: 'ftp://x' }),
    );
    expect(e).toMatch(/S3_ENDPOINT/);
  });

  it('nombre de bucket inválido', () => {
    expect(error(configuracionS3('aws', { ...claves, S3_BUCKET: 'Mi Bucket!', S3_REGION: 'x' }))).toMatch(
      /S3_BUCKET no es un nombre válido/,
    );
  });

  it('ARCHIVOS_REDIRIGIR: sí en la nube, no con emuladores', () => {
    expect(
      ok(
        configuracionS3('aws', {
          ...claves,
          S3_BUCKET: 'archivos',
          S3_REGION: 'x',
          ARCHIVOS_REDIRIGIR: 'true',
        }),
      ).redirigir,
    ).toBe(true);
    expect(error(configuracionS3('s3proxy', { ARCHIVOS_REDIRIGIR: 'true' }))).toMatch(/emulador/);
    expect(
      error(
        configuracionS3('aws', {
          ...claves,
          S3_BUCKET: 'archivos',
          S3_REGION: 'x',
          ARCHIVOS_REDIRIGIR: 'tal vez',
        }),
      ),
    ).toMatch(/ARCHIVOS_REDIRIGIR/);
  });

  it('ARCHIVOS_CREAR_BUCKET se puede activar fuera de los emuladores', () => {
    expect(
      ok(
        configuracionS3('aws', {
          ...claves,
          S3_BUCKET: 'archivos',
          S3_REGION: 'x',
          ARCHIVOS_CREAR_BUCKET: 'true',
        }),
      ).crearBucket,
    ).toBe(true);
  });
});
