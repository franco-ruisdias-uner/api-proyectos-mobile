import {
  configuracionBase,
  motorDeProveedor,
  type Variables,
} from './proveedores.js';

const supabase =
  'postgresql://postgres.abcd:p%40ss%2Fw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

const ok = (e: Variables) => {
  const r = configuracionBase(e);
  if (!r.ok) throw new Error(r.problemas.join(' | '));
  return r.config;
};
const mal = (e: Variables) => {
  const r = configuracionBase(e);
  if (r.ok) throw new Error('se esperaba un error');
  return r.problemas.join(' | ');
};

describe('AGENTS §18.1 — Presets de base de datos', () => {
  it('sin proveedor, todo sigue como en §5.1', () => {
    expect(ok({})).toMatchObject({
      proveedor: null,
      motor: 'better-sqlite3',
      esquema: null,
      ssl: 'no',
      conexion: null,
    });
  });

  it('supabase: postgres, esquema api, cifrado sin verificar, URL decodificada', () => {
    const c = ok({ DB_PROVEEDOR: 'supabase', DB_URL: supabase });
    expect(c).toMatchObject({
      motor: 'postgres',
      esquema: 'api',
      ssl: 'si-sin-verificar',
    });
    expect(c.conexion).toEqual({
      host: 'aws-0-sa-east-1.pooler.supabase.com',
      port: 5432,
      username: 'postgres.abcd',
      password: 'p@ss/w',
      database: 'postgres',
    });
  });

  it('con DB_SSL_CA pasa a verificar contra esa CA', () => {
    const c = ok({
      DB_PROVEEDOR: 'supabase',
      DB_URL: supabase,
      DB_SSL_CA: 'certs/ca.pem',
    });
    expect(c).toMatchObject({ ssl: 'si', sslCa: 'certs/ca.pem' });
  });

  it('DB_ESQUEMA pisa el del preset', () => {
    expect(
      ok({ DB_PROVEEDOR: 'supabase', DB_URL: supabase, DB_ESQUEMA: 'otro' })
        .esquema,
    ).toBe('otro');
  });

  it('neon: certificado público, se verifica', () => {
    const c = ok({
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p@ep-x.sa-east-1.aws.neon.tech/db',
    });
    expect(c).toMatchObject({
      motor: 'postgres',
      ssl: 'si',
      esquema: 'public',
    });
  });

  it('aiven-postgres y aiven-mysql', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-postgres',
        DB_URL: 'postgres://u:p@pg-x.aivencloud.com:12345/db',
      }),
    ).toMatchObject({ motor: 'postgres', ssl: 'si-sin-verificar' });
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://u:p@my-x.aivencloud.com:12345/db',
      }),
    ).toMatchObject({ motor: 'mysql', esquema: null });
  });

  it('motorDeProveedor', () => {
    expect(motorDeProveedor('neon')).toBe('postgres');
    expect(motorDeProveedor('aiven-mysql')).toBe('mysql');
    expect(motorDeProveedor(undefined)).toBeNull();
    expect(motorDeProveedor('otro')).toBeNull();
  });

  it.each([
    [
      'supabase: pooler en modo transacción',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.a:p@x.pooler.supabase.com:6543/postgres',
      },
      /modo transacción.*5432/,
    ],
    [
      'supabase: conexión directa (IPv6)',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:p@db.abcd.supabase.co:5432/postgres',
      },
      /pooler en modo sesión.*IPv6/,
    ],
    [
      'supabase: usuario sin referencia',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:p@x.pooler.supabase.com:5432/postgres',
      },
      /postgres\.<referencia/,
    ],
    [
      'neon con otro host',
      { DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@localhost/db' },
      /Neon.*neon\.tech/,
    ],
    [
      'aiven con otro host',
      { DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:p@localhost/db' },
      /Aiven.*aivencloud/,
    ],
    ['falta DB_URL', { DB_PROVEEDOR: 'neon' }, /falta DB_URL/],
    [
      'proveedor desconocido',
      { DB_PROVEEDOR: 'heroku' },
      /DB_PROVEEDOR tiene que ser uno de/,
    ],
    [
      'motor contradictorio',
      {
        DB_PROVEEDOR: 'neon',
        DB_MOTOR: 'mysql',
        DB_URL: 'postgres://u:p@a.neon.tech/d',
      },
      /usa postgres.*DB_MOTOR dice mysql/,
    ],
    ['DB_SSL inválido', { DB_SSL: 'quizas' }, /DB_SSL tiene que ser uno de/],
    [
      'DB_ESQUEMA con MySQL',
      { DB_MOTOR: 'mysql', DB_ESQUEMA: 'api' },
      /sólo se usa con PostgreSQL/,
    ],
    [
      'DB_URL ilegible',
      { DB_PROVEEDOR: 'neon', DB_URL: 'esto no es una url' },
      /no se entiende/,
    ],
  ])('%s → mensaje en castellano', (_caso, entorno, patron) => {
    expect(mal(entorno)).toMatch(patron);
  });
});
