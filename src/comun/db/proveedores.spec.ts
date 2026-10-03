import { configuracionBase, explicarErrorDeBase, partesDeUrl } from './proveedores.js';

const supabase = 'postgres://postgres.abcd:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

function config(variables: Record<string, string>) {
  const r = configuracionBase(variables);
  if ('errores' in r) throw new Error(r.errores.join(' | '));
  return r.config;
}
function errores(variables: Record<string, string>): string {
  const r = configuracionBase(variables);
  if (!('errores' in r)) throw new Error('tendría que fallar');
  return r.errores.join(' | ');
}

describe('AGENTS §18.1 — configuracionBase: presets de bases administradas', () => {
  it('sin DB_PROVEEDOR todo sigue como en §5.1', () => {
    expect(config({})).toMatchObject({
      motor: 'better-sqlite3',
      ssl: 'no',
      esquema: null,
      proveedor: null,
    });
    expect(config({ DB_MOTOR: 'mariadb', DB_URL: 'mysql://r:@localhost/api' })).toMatchObject({
      motor: 'mariadb',
    });
  });

  it('supabase: postgres, cifrado sin verificar y esquema «api»', () => {
    expect(config({ DB_PROVEEDOR: 'supabase', DB_URL: supabase })).toMatchObject({
      motor: 'postgres',
      ssl: 'si-sin-verificar',
      esquema: 'api',
    });
  });

  it('supabase con la CA del proveedor pasa a verificar', () => {
    expect(
      config({ DB_PROVEEDOR: 'supabase', DB_URL: supabase, DB_SSL_CA: './ca.crt' }),
    ).toMatchObject({
      ssl: 'si',
      sslCa: './ca.crt',
    });
  });

  it('supabase sin puerto explícito sirve (el default es 5432)', () => {
    expect(
      config({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.abcd:c@x.pooler.supabase.com/postgres',
      }),
    ).toMatchObject({ motor: 'postgres' });
  });

  it('supabase rechaza la conexión directa (sólo IPv6) y explica qué usar', () => {
    expect(
      errores({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:c@db.abcd.supabase.co:5432/postgres',
      }),
    ).toMatch(/IPv6.*pooler/s);
  });

  it('supabase rechaza el pooler en modo transacción (6543)', () => {
    expect(
      errores({ DB_PROVEEDOR: 'supabase', DB_URL: supabase.replace(':5432', ':6543') }),
    ).toMatch(/modo transacción.*5432/s);
  });

  it('supabase rechaza un usuario sin el id del proyecto', () => {
    expect(
      errores({ DB_PROVEEDOR: 'supabase', DB_URL: supabase.replace('postgres.abcd', 'postgres') }),
    ).toMatch(/postgres\.<id del proyecto>/);
  });

  it('supabase rechaza un host de otro servicio', () => {
    expect(errores({ DB_PROVEEDOR: 'supabase', DB_URL: 'postgres://u:c@ejemplo.com/db' })).toMatch(
      /pooler\.supabase\.com/,
    );
  });

  it('neon: cifrado y verificado, esquema public, host .neon.tech', () => {
    expect(
      config({
        DB_PROVEEDOR: 'neon',
        DB_URL: 'postgres://u:c@ep-1.sa-east-1.aws.neon.tech/neondb',
      }),
    ).toMatchObject({
      motor: 'postgres',
      ssl: 'si',
      esquema: 'public',
    });
    expect(errores({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:c@ejemplo.com/db' })).toMatch(
      /neon\.tech/,
    );
  });

  it('aiven-postgres y aiven-mysql: host .aivencloud.com', () => {
    expect(
      config({
        DB_PROVEEDOR: 'aiven-postgres',
        DB_URL: 'postgres://u:c@pg-1.aivencloud.com:1234/db',
      }),
    ).toMatchObject({
      motor: 'postgres',
      ssl: 'si-sin-verificar',
    });
    expect(
      config({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:c@my-1.aivencloud.com:1234/db' }),
    ).toMatchObject({
      motor: 'mysql',
      esquema: null,
    });
    expect(errores({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:c@ejemplo.com/db' })).toMatch(
      /aivencloud\.com/,
    );
  });

  it('el preset gana sobre DB_MOTOR', () => {
    expect(
      config({
        DB_PROVEEDOR: 'neon',
        DB_MOTOR: 'better-sqlite3',
        DB_URL: 'postgres://u:c@e.neon.tech/db',
      }).motor,
    ).toBe('postgres');
  });

  it('falta DB_URL, DB_PROVEEDOR desconocido, DB_SSL inválido y DB_ESQUEMA inválido', () => {
    expect(errores({ DB_PROVEEDOR: 'supabase' })).toMatch(/Falta DB_URL/);
    expect(errores({ DB_PROVEEDOR: 'heroku' })).toMatch(/DB_PROVEEDOR.*supabase/);
    expect(
      errores({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:c@e.neon.tech/db', DB_SSL: 'quizas' }),
    ).toMatch(/DB_SSL/);
    expect(
      errores({ DB_MOTOR: 'postgres', DB_URL: 'postgres://u:c@h/db', DB_ESQUEMA: 'Mi Esquema' }),
    ).toMatch(/DB_ESQUEMA/);
    expect(errores({ DB_MOTOR: 'mysql', DB_URL: 'mysql://u:c@h/db', DB_ESQUEMA: 'api' })).toMatch(
      /sólo.*PostgreSQL/,
    );
  });

  it('DB_SSL manda sobre el preset', () => {
    expect(config({ DB_PROVEEDOR: 'supabase', DB_URL: supabase, DB_SSL: 'no' }).ssl).toBe('no');
  });
});

describe('AGENTS §18.1 — DB_URL se parsea con URL y se decodifica', () => {
  it('una contraseña con símbolos raros llega entera', () => {
    expect(partesDeUrl('postgres://usuario:p%40ss%2Fw%23rd%3A1@host.com:6543/mi%20base')).toEqual({
      host: 'host.com',
      puerto: 6543,
      usuario: 'usuario',
      clave: 'p@ss/w#rd:1',
      base: 'mi base',
    });
  });

  it('sin puerto, el puerto queda sin definir', () => {
    expect(partesDeUrl('mysql://u:c@host/db').puerto).toBeUndefined();
  });
});

describe('AGENTS §18.1 — Un error de certificado dice qué opción usar', () => {
  it('con DB_SSL=si-sin-verificar sugiere DB_SSL_CA; con si, sugiere las dos salidas', () => {
    expect(
      explicarErrorDeBase(
        new Error('self-signed certificate in certificate chain'),
        'si-sin-verificar',
      ),
    ).toMatch(/DB_SSL_CA/);
    expect(explicarErrorDeBase(new Error('unable to verify the first certificate'), 'si')).toMatch(
      /DB_SSL=si-sin-verificar/,
    );
  });
  it('contraseña, servidor inexistente y conexión rechazada', () => {
    expect(
      explicarErrorDeBase(new Error('password authentication failed for user "x"'), 'no'),
    ).toMatch(/Usuario o contraseña/);
    expect(explicarErrorDeBase(new Error('getaddrinfo ENOTFOUND db.x.supabase.co'), 'no')).toMatch(
      /pooler/,
    );
    expect(explicarErrorDeBase(new Error('connect ECONNREFUSED 127.0.0.1:5432'), 'no')).toMatch(
      /host y el puerto/,
    );
  });
});
