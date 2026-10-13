import { leerEntorno } from './entorno.js';

const minimo = { JWT_SECRETO: 'x'.repeat(40) };

describe('AGENTS §11.3 — La configuración se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite, puerto 3000 y archivos locales', () => {
    const e = leerEntorno(minimo);
    expect(e).toMatchObject({
      PUERTO: 3000,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: 'datos/api.sqlite',
      ARCHIVOS_PROVEEDOR: 'local',
      NOTIFICACIONES: 'registro',
      SIMULACION_HABILITADA: true,
      DB_SINCRONIZAR: true,
    });
  });

  it('sin JWT_SECRETO no arranca y dice qué falta en castellano', () => {
    expect(() => leerEntorno({})).toThrow(/Falta JWT_SECRETO/);
  });

  it('PORT sirve si no está PUERTO (lo inyectan los hosts)', () => {
    expect(leerEntorno({ ...minimo, PORT: '8080' }).PUERTO).toBe(8080);
    expect(
      leerEntorno({ ...minimo, PORT: '8080', PUERTO: '3001' }).PUERTO,
    ).toBe(3001);
  });

  it.each([
    [{ DB_MOTOR: 'sqlite' }, /DB_MOTOR tiene que ser/],
    [{ DB_MOTOR: 'postgres' }, /Falta DB_URL/],
    [
      { DB_MOTOR: 'mysql', DB_URL: 'no es url' },
      /DB_URL no es una dirección válida/,
    ],
    [{ PUERTO: 'abc' }, /PUERTO tiene que ser/],
    [{ DB_SINCRONIZAR: 'quizas' }, /DB_SINCRONIZAR tiene que ser/],
    [{ RELOJ_FIJO: '2026-09-15T08:00:00' }, /RELOJ_FIJO/],
    [{ URL_PUBLICA: 'http://x.com/api' }, /URL_PUBLICA/],
    [{ ARCHIVOS_PROVEEDOR: 'firebase' }, /ARCHIVOS_PROVEEDOR/],
    [{ NOTIFICACIONES: 'sms' }, /NOTIFICACIONES/],
    [{ ENTORNO: 'produccion' }, /ENTORNO tiene que ser/],
  ])('%o no arranca', (extra, mensaje) => {
    expect(() => leerEntorno({ ...minimo, ...extra })).toThrow(mensaje);
  });

  it('acepta los cuatro motores', () => {
    expect(
      leerEntorno({
        ...minimo,
        DB_MOTOR: 'mariadb',
        DB_URL: 'mysql://a:b@h:3306/api',
      }).DB_MOTOR,
    ).toBe('mariadb');
    expect(
      leerEntorno({
        ...minimo,
        DB_MOTOR: 'postgres',
        DB_URL: 'postgres://a:b@h/api',
      }).DB_URL,
    ).toBe('postgres://a:b@h/api');
  });

  it('la simulación de fallas está apagada por defecto fuera de desarrollo', () => {
    expect(
      leerEntorno({ ...minimo, ENTORNO: 'test' }).SIMULACION_HABILITADA,
    ).toBe(false);
  });

  it('URL_PUBLICA se guarda sin la barra final', () => {
    expect(
      leerEntorno({ ...minimo, URL_PUBLICA: 'https://api.ejemplo.com/' })
        .URL_PUBLICA,
    ).toBe('https://api.ejemplo.com');
  });
});

describe('AGENTS §18.2 — ENTORNO=publicado no arranca con una configuración de juguete', () => {
  const SUPA =
    'postgres://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
  const publicado = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'una-clave-larga-y-secreta-de-mas-de-32-caracteres',
    DB_PROVEEDOR: 'supabase',
    DB_URL: SUPA,
    ARCHIVOS_PROVEEDOR: 'supabase',
    SUPABASE_PROYECTO: 'abcdefgh',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    S3_ACCESS_KEY_ID: 'AK',
    S3_SECRET_ACCESS_KEY: 'SK',
    SIMULACION_HABILITADA: 'false',
  };

  it('la configuración completa arranca', () => {
    const e = leerEntorno(publicado);
    expect(e).toMatchObject({
      DB_MOTOR: 'postgres',
      DB_ESQUEMA: 'api',
      DB_SSL: 'si-sin-verificar',
      ARCHIVOS_PROVEEDOR: 'supabase',
    });
    expect(e.ARCHIVOS_S3?.endpoint).toBe(
      'https://abcdefgh.storage.supabase.co/storage/v1/s3',
    );
  });

  it('con SQLite no arranca', () => {
    const { DB_PROVEEDOR: _p, DB_URL: _u, ...sinBase } = publicado;
    expect(() => leerEntorno(sinBase)).toThrow(/no puede ser SQLite/);
  });

  it('con archivos locales no arranca', () => {
    expect(() =>
      leerEntorno({ ...publicado, ARCHIVOS_PROVEEDOR: 'local' }),
    ).toThrow(/no pueden ser "local"/);
  });

  it('con el JWT_SECRETO de desarrollo no arranca', () => {
    expect(() =>
      leerEntorno({
        ...publicado,
        JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion',
      }),
    ).toThrow(/es el de desarrollo/);
  });

  it('con un JWT_SECRETO de menos de 32 caracteres no arranca', () => {
    expect(() => leerEntorno({ ...publicado, JWT_SECRETO: 'corto' })).toThrow(
      /al menos 32 caracteres/,
    );
  });

  it('con la simulación prendida no arranca', () => {
    expect(() =>
      leerEntorno({ ...publicado, SIMULACION_HABILITADA: 'true' }),
    ).toThrow(/SIMULACION_HABILITADA=false/);
  });

  it('sin avisar de la simulación, queda apagada (no es de desarrollo)', () => {
    const { SIMULACION_HABILITADA: _s, ...sin } = publicado;
    expect(leerEntorno(sin).SIMULACION_HABILITADA).toBe(false);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() =>
      leerEntorno({ ENTORNO: 'publicado', JWT_SECRETO: 'corto' }),
    ).toThrow(/SQLite[\s\S]*local[\s\S]*32 caracteres/);
  });
});

describe('AGENTS §18.1 / §17.2 — Los presets entran en la configuración', () => {
  it('una variable de archivos que falta frena el arranque y dice dónde se consigue', () => {
    expect(() => leerEntorno({ ...minimo, ARCHIVOS_PROVEEDOR: 'r2' })).toThrow(
      /R2_CUENTA[\s\S]*ID de cuenta/,
    );
  });

  it('una DB_URL de Supabase en modo transacción frena el arranque', () => {
    expect(() =>
      leerEntorno({
        ...minimo,
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.abc:x@h.pooler.supabase.com:6543/postgres',
      }),
    ).toThrow(/modo transacción/);
  });

  it('DB_ESQUEMA sin proveedor se respeta en PostgreSQL', () => {
    expect(
      leerEntorno({
        ...minimo,
        DB_MOTOR: 'postgres',
        DB_URL: 'postgres://a:b@h/api',
        DB_ESQUEMA: 'api',
      }).DB_ESQUEMA,
    ).toBe('api');
  });
});
