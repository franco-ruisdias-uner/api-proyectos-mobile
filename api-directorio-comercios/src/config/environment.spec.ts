import { validarEntorno } from './environment.js';

const minimo = { JWT_SECRETO: 'un-secreto-de-prueba' };

describe('AGENTS §11.3 — El entorno se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite y los defaults de desarrollo', () => {
    const e = validarEntorno(minimo);
    expect(e).toMatchObject({
      puerto: 3000,
      entorno: 'desarrollo',
      dbMotor: 'better-sqlite3',
      dbArchivo: 'datos/api.sqlite',
      dbSincronizar: true,
      archivosProveedor: 'local',
      directorioArchivos: './archivos',
      notificaciones: 'expo',
      simulacionHabilitada: true,
      sembrarSiVacia: false,
      confiarProxy: false,
      urlPublica: null,
      relojFijo: null,
    });
  });

  it('PUERTO gana sobre PORT, y PORT sirve si no hay PUERTO', () => {
    expect(validarEntorno({ ...minimo, PORT: '8080' }).puerto).toBe(8080);
    expect(validarEntorno({ ...minimo, PORT: '8080', PUERTO: '4000' }).puerto).toBe(4000);
  });

  it('en test la simulación de fallas viene apagada', () => {
    expect(validarEntorno({ ...minimo, ENTORNO: 'test' }).simulacionHabilitada).toBe(false);
  });

  it('RELOJ_FIJO se interpreta como instante', () => {
    expect(
      validarEntorno({
        ...minimo,
        RELOJ_FIJO: '2026-11-14T21:00:00-03:00',
      }).relojFijo?.toISOString(),
    ).toBe('2026-11-15T00:00:00.000Z');
  });

  it.each([
    [{}, /JWT_SECRETO/],
    [{ ...minimo, DB_MOTOR: 'sqlite' }, /DB_MOTOR.*better-sqlite3/],
    [{ ...minimo, DB_MOTOR: 'postgres' }, /DB_URL/],
    [{ ...minimo, DB_MOTOR: 'mysql', DB_URL: 'no es url' }, /DB_URL/],
    [{ ...minimo, PUERTO: 'tres mil' }, /PUERTO/],
    [{ ...minimo, DB_SINCRONIZAR: 'quizas' }, /DB_SINCRONIZAR/],
    [{ ...minimo, RELOJ_FIJO: '2026-11-14 21:00' }, /RELOJ_FIJO/],
    [{ ...minimo, NOTIFICACIONES: 'paloma' }, /NOTIFICACIONES/],
    [{ ...minimo, URL_PUBLICA: 'mi-compu' }, /URL_PUBLICA/],
    [{ ...minimo, ARCHIVOS_PROVEEDOR: 'ftp' }, /ARCHIVOS_PROVEEDOR/],
  ])('%j no arranca y explica qué falta', (env, mensaje) => {
    expect(() => validarEntorno(env)).toThrow(mensaje);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() => validarEntorno({ PUERTO: 'x' })).toThrow(/PUERTO[\s\S]*JWT_SECRETO/);
  });
});

describe('AGENTS §18.2 — ENTORNO=publicado no arranca con una configuración de desarrollo', () => {
  const publicado = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'una-clave-larga-y-secreta-de-al-menos-32-caracteres',
    DB_PROVEEDOR: 'supabase',
    DB_URL: 'postgres://postgres.abcd:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    ARCHIVOS_PROVEEDOR: 'supabase',
    SUPABASE_PROYECTO: 'abcd',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    S3_ACCESS_KEY_ID: 'AK',
    S3_SECRET_ACCESS_KEY: 'SK',
  };

  it('la configuración de referencia (Render + Supabase) arranca, con la simulación apagada por defecto', () => {
    const e = validarEntorno(publicado);
    expect(e).toMatchObject({
      entorno: 'publicado',
      dbMotor: 'postgres',
      dbEsquema: 'api',
      archivosProveedor: 'supabase',
      simulacionHabilitada: false,
    });
    expect(e.s3?.endpoint).toBe('https://abcd.storage.supabase.co/storage/v1/s3');
  });

  it.each([
    ['la base es SQLite', { DB_PROVEEDOR: '', DB_URL: '', DB_MOTOR: 'better-sqlite3' }, /SQLite/],
    ['los archivos son locales', { ARCHIVOS_PROVEEDOR: 'local' }, /ARCHIVOS_PROVEEDOR=local/],
    ['los archivos son de un emulador', { ARCHIVOS_PROVEEDOR: 's3proxy' }, /emulador/],
    [
      'el JWT_SECRETO es el de desarrollo',
      { JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' },
      /JWT_SECRETO/,
    ],
    ['el JWT_SECRETO es corto', { JWT_SECRETO: 'corto' }, /32 caracteres/],
    ['la simulación está prendida', { SIMULACION_HABILITADA: 'true' }, /SIMULACION_HABILITADA/],
  ])('no arranca si %s', (_motivo, cambio, mensaje) => {
    expect(() => validarEntorno({ ...publicado, ...cambio })).toThrow(mensaje);
  });

  it('en desarrollo esas mismas cosas están permitidas', () => {
    expect(() =>
      validarEntorno({ JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' }),
    ).not.toThrow();
  });

  it('con un proveedor de archivos en la nube, si falta una variable dice cuál y dónde se consigue', () => {
    expect(() =>
      validarEntorno({
        JWT_SECRETO: 'x',
        ARCHIVOS_PROVEEDOR: 'r2',
        S3_BUCKET: 'b',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      }),
    ).toThrow(/R2_CUENTA.*Account ID/s);
  });

  it('ARCHIVOS_REDIRIGIR tiene que ser true o false', () => {
    expect(() => validarEntorno({ JWT_SECRETO: 'x', ARCHIVOS_REDIRIGIR: 'tal vez' })).toThrow(
      /ARCHIVOS_REDIRIGIR/,
    );
  });
});
