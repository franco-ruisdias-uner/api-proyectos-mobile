import { validarEntorno } from './environment.js';

const base = { JWT_SECRETO: 'secreto-de-prueba-bastante-largo' };

describe('AGENTS §11.3 — Configuración validada al arrancar', () => {
  it('defaults de desarrollo con SQLite', () => {
    const e = validarEntorno(base);
    expect(e.DB_MOTOR).toBe('better-sqlite3');
    expect(e.DB_ARCHIVO).toBe('datos/api.sqlite');
    expect(e.PUERTO).toBe(3000);
    expect(e.DB_SINCRONIZAR).toBe(true);
    expect(e.SIMULACION_HABILITADA).toBe(true);
    expect(e.ARCHIVOS_PROVEEDOR).toBe('local');
    expect(e.RELOJ_FIJO).toBeNull();
  });

  it('usa PORT si no hay PUERTO (Render, Koyeb)', () => {
    expect(validarEntorno({ ...base, PORT: '8080' }).PUERTO).toBe(8080);
    expect(validarEntorno({ ...base, PORT: '8080', PUERTO: '3001' }).PUERTO).toBe(3001);
  });

  it('sin JWT_SECRETO no arranca y lo dice en castellano', () => {
    expect(() => validarEntorno({})).toThrow(/JWT_SECRETO/);
  });

  it('motor desconocido', () => {
    expect(() => validarEntorno({ ...base, DB_MOTOR: 'oracle' })).toThrow(/DB_MOTOR/);
  });

  it('postgres, mysql y mariadb piden DB_URL', () => {
    for (const motor of ['postgres', 'mysql', 'mariadb']) {
      expect(() => validarEntorno({ ...base, DB_MOTOR: motor })).toThrow(/DB_URL/);
    }
    expect(validarEntorno({ ...base, DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h:5432/d' }).DB_URL).toBe(
      'postgres://a:b@h:5432/d',
    );
  });

  it('RELOJ_FIJO tiene que ser un instante ISO', () => {
    expect(() => validarEntorno({ ...base, RELOJ_FIJO: 'ayer' })).toThrow(/RELOJ_FIJO/);
    expect(
      validarEntorno({ ...base, RELOJ_FIJO: '2026-11-14T21:00:00-03:00' }).RELOJ_FIJO?.toISOString(),
    ).toBe('2026-11-15T00:00:00.000Z');
  });

  it('booleanos: true/false', () => {
    expect(validarEntorno({ ...base, SIMULACION_HABILITADA: 'false' }).SIMULACION_HABILITADA).toBe(false);
    expect(() => validarEntorno({ ...base, DB_SINCRONIZAR: 'quizas' })).toThrow(/DB_SINCRONIZAR/);
  });

  it('URL_PUBLICA tiene que ser una URL http(s)', () => {
    expect(() => validarEntorno({ ...base, URL_PUBLICA: 'no-es-url' })).toThrow(/URL_PUBLICA/);
    expect(validarEntorno({ ...base, URL_PUBLICA: 'https://api.ejemplo.com/' }).URL_PUBLICA).toBe(
      'https://api.ejemplo.com',
    );
    expect(validarEntorno({ ...base, URL_PUBLICA: '' }).URL_PUBLICA).toBeNull();
  });

  it('NOTIFICACIONES: expo o registro', () => {
    expect(validarEntorno(base).NOTIFICACIONES).toBe('expo');
    expect(() => validarEntorno({ ...base, NOTIFICACIONES: 'sms' })).toThrow(/NOTIFICACIONES/);
  });

  it('ARCHIVOS_PROVEEDOR desconocido', () => {
    expect(() => validarEntorno({ ...base, ARCHIVOS_PROVEEDOR: 'ftp' })).toThrow(/ARCHIVOS_PROVEEDOR/);
  });

  it('un proveedor en la nube sin sus variables no arranca y dice cuáles faltan', () => {
    expect(() => validarEntorno({ ...base, ARCHIVOS_PROVEEDOR: 'supabase' })).toThrow(
      /SUPABASE_PROYECTO[\s\S]*S3_BUCKET[\s\S]*S3_REGION[\s\S]*S3_ACCESS_KEY_ID/,
    );
  });

  it('s3proxy no pide nada', () => {
    const e = validarEntorno({ ...base, ARCHIVOS_PROVEEDOR: 's3proxy' });
    expect(e.ALMACEN_S3?.endpoint).toBe('http://s3:8080');
    expect(validarEntorno(base).ALMACEN_S3).toBeNull();
  });

  it('DB_PROVEEDOR=supabase completa motor, cifrado y esquema', () => {
    const e = validarEntorno({
      ...base,
      DB_PROVEEDOR: 'supabase',
      DB_URL: 'postgres://postgres.abc:x@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    });
    expect(e).toMatchObject({ DB_MOTOR: 'postgres', DB_SSL: 'si-sin-verificar', DB_ESQUEMA: 'api' });
  });

  it('DB_PROVEEDOR=supabase con la conexión directa no arranca', () => {
    expect(() =>
      validarEntorno({
        ...base,
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:x@db.abc.supabase.co:5432/postgres',
      }),
    ).toThrow(/IPv6/);
  });
});

describe('AGENTS §18.2 — ENTORNO=publicado no arranca con una configuración de desarrollo', () => {
  const nube = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'un-secreto-largo-y-propio-de-mas-de-32-caracteres',
    DB_PROVEEDOR: 'supabase',
    DB_URL: 'postgres://postgres.abc:x@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
    ARCHIVOS_PROVEEDOR: 'supabase',
    SUPABASE_PROYECTO: 'abcdefghij',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    S3_ACCESS_KEY_ID: 'clave',
    S3_SECRET_ACCESS_KEY: 'secreto',
  };

  it('la configuración completa de Render arranca', () => {
    const e = validarEntorno({ ...nube, CONFIAR_PROXY: 'true' });
    expect(e.ENTORNO).toBe('publicado');
    expect(e.SIMULACION_HABILITADA).toBe(false);
  });

  it('con SQLite, no', () => {
    expect(() =>
      validarEntorno({ ...nube, DB_PROVEEDOR: '', DB_URL: '', DB_MOTOR: 'better-sqlite3' }),
    ).toThrow(/ENTORNO=publicado no se puede usar SQLite/);
  });

  it('con los archivos en disco, no', () => {
    expect(() => validarEntorno({ ...nube, ARCHIVOS_PROVEEDOR: 'local' })).toThrow(
      /no se pueden guardar los archivos en disco/,
    );
  });

  it('con el JWT_SECRETO de desarrollo, no', () => {
    expect(() =>
      validarEntorno({ ...nube, JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' }),
    ).toThrow(/JWT_SECRETO tiene que ser propio/);
  });

  it('con un JWT_SECRETO de menos de 32 caracteres, no', () => {
    expect(() => validarEntorno({ ...nube, JWT_SECRETO: 'corto' })).toThrow(/al menos 32 caracteres/);
  });

  it('con SIMULACION_HABILITADA=true, no', () => {
    expect(() => validarEntorno({ ...nube, SIMULACION_HABILITADA: 'true' })).toThrow(
      /SIMULACION_HABILITADA tiene que ser false/,
    );
  });

  it('cuenta todos los problemas juntos', () => {
    let mensaje = '';
    try {
      validarEntorno({ ENTORNO: 'publicado', JWT_SECRETO: 'corto', SIMULACION_HABILITADA: 'true' });
    } catch (error) {
      mensaje = (error as Error).message;
    }
    for (const parte of ['SQLite', 'archivos en disco', 'JWT_SECRETO', 'SIMULACION_HABILITADA']) {
      expect(mensaje).toContain(parte);
    }
  });

  it('en desarrollo nada de esto molesta', () => {
    expect(() => validarEntorno({ JWT_SECRETO: 'solo-para-desarrollo' })).not.toThrow();
  });
});
