import { buildConfiguration } from './configuration.js';
import { validateEnv } from './env.validation.js';

const minimo = { JWT_SECRET: 'x'.repeat(40) };

describe('AGENTS §11.3 — La configuración se valida al arrancar', () => {
  it('con lo mínimo arranca con SQLite, puerto 3000 y archivos locales', () => {
    const c = buildConfiguration(minimo);
    expect(c.app).toMatchObject({
      env: 'development',
      port: 3000,
      logLevel: 'log',
      logFormat: 'text',
      simulationEnabled: true,
    });
    expect(c.database).toMatchObject({
      engine: 'better-sqlite3',
      file: 'data/api.sqlite',
      synchronize: true,
      ssl: 'off',
    });
    expect(c.storage).toMatchObject({
      provider: 'local',
      dir: './uploads',
      s3: null,
    });
    expect(c.notifications.provider).toBe('log');
    expect(c.http.corsOrigins).toBe('*');
  });

  it('sin JWT_SECRET no arranca y dice qué falta en castellano', () => {
    expect(() => validateEnv({})).toThrow(/Falta JWT_SECRET/);
  });

  it('PORT llega como texto y sale como número', () => {
    expect(buildConfiguration({ ...minimo, PORT: '8080' }).app.port).toBe(8080);
  });

  it('una variable vacía (VAR=) cuenta como que no está', () => {
    expect(buildConfiguration({ ...minimo, PORT: '  ' }).app.port).toBe(3000);
  });

  it.each([
    [{ DB_ENGINE: 'sqlite' }, /DB_ENGINE tiene que ser/],
    [{ DB_ENGINE: 'postgres' }, /Falta DB_URL/],
    [
      { DB_ENGINE: 'mysql', DB_URL: 'no es url' },
      /DB_URL no es una dirección válida/,
    ],
    [{ PORT: 'abc' }, /PORT tiene que ser/],
    [{ PORT: '70000' }, /PORT tiene que estar entre 1 y 65535/],
    [{ DB_SYNCHRONIZE: 'quizas' }, /DB_SYNCHRONIZE tiene que ser/],
    [{ FIXED_CLOCK: '2026-09-15T08:00:00' }, /FIXED_CLOCK/],
    [{ PUBLIC_URL: 'http://x.com/api' }, /PUBLIC_URL/],
    [{ STORAGE_PROVIDER: 'firebase' }, /STORAGE_PROVIDER/],
    [{ PUSH_PROVIDER: 'sms' }, /PUSH_PROVIDER/],
    [{ APP_ENV: 'produccion' }, /APP_ENV tiene que ser/],
    [{ LOG_LEVEL: 'todo' }, /LOG_LEVEL tiene que ser/],
    [{ DB_SSL: 'si' }, /DB_SSL tiene que ser/],
  ])('%o no arranca', (extra, mensaje) => {
    expect(() => validateEnv({ ...minimo, ...extra })).toThrow(mensaje);
  });

  it('junta los problemas de distintas variables en un solo mensaje', () => {
    expect(() => validateEnv({ PORT: 'abc', STORAGE_PROVIDER: 'r2' })).toThrow(
      /PORT[\s\S]*JWT_SECRET[\s\S]*R2_ACCOUNT_ID/,
    );
  });

  it('acepta los cuatro motores', () => {
    expect(
      buildConfiguration({
        ...minimo,
        DB_ENGINE: 'mariadb',
        DB_URL: 'mysql://a:b@h:3306/api',
      }).database.engine,
    ).toBe('mariadb');
    expect(
      buildConfiguration({
        ...minimo,
        DB_ENGINE: 'postgres',
        DB_URL: 'postgres://a:b@h/api',
      }).database.url,
    ).toBe('postgres://a:b@h/api');
  });

  it('la simulación de fallas está apagada por defecto fuera de development', () => {
    expect(
      buildConfiguration({ ...minimo, APP_ENV: 'test' }).app.simulationEnabled,
    ).toBe(false);
  });

  it('PUBLIC_URL se guarda sin la barra final', () => {
    expect(
      buildConfiguration({ ...minimo, PUBLIC_URL: 'https://api.ejemplo.com/' })
        .http.publicUrl,
    ).toBe('https://api.ejemplo.com');
  });

  it('CORS_ORIGINS acepta una lista separada por comas', () => {
    expect(
      buildConfiguration({
        ...minimo,
        CORS_ORIGINS: 'http://localhost:8081, https://app.ejemplo.com/',
      }).http.corsOrigins,
    ).toEqual(['http://localhost:8081', 'https://app.ejemplo.com']);
  });

  it('los logs salen en JSON en production y en texto en el resto, salvo que LOG_FORMAT diga otra cosa', () => {
    expect(buildConfiguration(minimo).app.logFormat).toBe('text');
    expect(
      buildConfiguration({ ...minimo, LOG_FORMAT: 'json' }).app.logFormat,
    ).toBe('json');
  });
});

describe('AGENTS §18.2 — APP_ENV=production no arranca con una configuración de juguete', () => {
  const SUPA =
    'postgres://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
  const produccion = {
    APP_ENV: 'production',
    JWT_SECRET: 'una-clave-larga-y-secreta-de-mas-de-32-caracteres',
    DB_PROVIDER: 'supabase',
    DB_URL: SUPA,
    STORAGE_PROVIDER: 'supabase',
    SUPABASE_PROJECT_REF: 'abcdefgh',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    S3_ACCESS_KEY_ID: 'AK',
    S3_SECRET_ACCESS_KEY: 'SK',
    SIMULATION_ENABLED: 'false',
  };

  it('la configuración completa arranca', () => {
    const c = buildConfiguration(produccion);
    expect(c.database).toMatchObject({
      engine: 'postgres',
      schema: 'api',
      ssl: 'no-verify',
      provider: 'supabase',
    });
    expect(c.storage.provider).toBe('supabase');
    expect(c.storage.s3?.endpoint).toBe(
      'https://abcdefgh.storage.supabase.co/storage/v1/s3',
    );
    expect(c.app.logFormat).toBe('json');
  });

  it('con SQLite no arranca', () => {
    const { DB_PROVIDER: _p, DB_URL: _u, ...sinBase } = produccion;
    expect(() => validateEnv(sinBase)).toThrow(/no puede ser SQLite/);
  });

  it('con archivos locales no arranca', () => {
    expect(() =>
      validateEnv({ ...produccion, STORAGE_PROVIDER: 'local' }),
    ).toThrow(/no pueden ser "local"/);
  });

  it('con el JWT_SECRET de desarrollo no arranca', () => {
    expect(() =>
      validateEnv({
        ...produccion,
        JWT_SECRET: 'solo-para-desarrollo-no-usar-en-produccion',
      }),
    ).toThrow(/es el de desarrollo/);
  });

  it('con un JWT_SECRET de menos de 32 caracteres no arranca', () => {
    expect(() => validateEnv({ ...produccion, JWT_SECRET: 'corto' })).toThrow(
      /al menos 32 caracteres/,
    );
  });

  it('con la simulación prendida no arranca', () => {
    expect(() =>
      validateEnv({ ...produccion, SIMULATION_ENABLED: 'true' }),
    ).toThrow(/SIMULATION_ENABLED=false/);
  });

  it('sin avisar de la simulación, queda apagada (no es de desarrollo)', () => {
    const { SIMULATION_ENABLED: _s, ...sin } = produccion;
    expect(buildConfiguration(sin).app.simulationEnabled).toBe(false);
  });

  it('junta todos los problemas en un solo mensaje', () => {
    expect(() =>
      validateEnv({ APP_ENV: 'production', JWT_SECRET: 'corto' }),
    ).toThrow(/SQLite[\s\S]*local[\s\S]*32 caracteres/);
  });
});

describe('AGENTS §18.1 / §17.2 — Los presets entran en la configuración', () => {
  it('una variable de archivos que falta frena el arranque y dice dónde se consigue', () => {
    expect(() => validateEnv({ ...minimo, STORAGE_PROVIDER: 'r2' })).toThrow(
      /R2_ACCOUNT_ID[\s\S]*ID de cuenta/,
    );
  });

  it('una DB_URL de Supabase en modo transacción frena el arranque', () => {
    expect(() =>
      validateEnv({
        ...minimo,
        DB_PROVIDER: 'supabase',
        DB_URL: 'postgres://postgres.abc:x@h.pooler.supabase.com:6543/postgres',
      }),
    ).toThrow(/modo transacción/);
  });

  it('DB_SCHEMA sin proveedor se respeta en PostgreSQL', () => {
    expect(
      buildConfiguration({
        ...minimo,
        DB_ENGINE: 'postgres',
        DB_URL: 'postgres://a:b@h/api',
        DB_SCHEMA: 'api',
      }).database.schema,
    ).toBe('api');
  });
});
