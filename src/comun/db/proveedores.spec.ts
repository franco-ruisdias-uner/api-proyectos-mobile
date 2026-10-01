import { configuracionBase, conexionDeUrl, type ConfiguracionBase } from './proveedores.js';

const POOLER =
  'postgres://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

function ok(entorno: Record<string, string>): ConfiguracionBase {
  const r = configuracionBase(entorno);
  if (!r.ok) throw new Error(r.problemas.join('\n'));
  return r.config;
}
function problemas(entorno: Record<string, string>): string[] {
  const r = configuracionBase(entorno);
  return r.ok ? [] : r.problemas;
}

describe('AGENTS §18.1 — presets de base de datos', () => {
  it('sin DB_PROVEEDOR todo queda como en §5.1', () => {
    expect(ok({})).toMatchObject({
      proveedor: null,
      motor: 'better-sqlite3',
      archivo: 'datos/api.sqlite',
      sincronizar: true,
      ssl: 'no',
      esquema: null,
    });
    expect(
      ok({ DB_MOTOR: 'postgres', DB_URL: 'postgres://api:api@localhost:5433/api' }),
    ).toMatchObject({
      motor: 'postgres',
      ssl: 'no',
      esquema: null,
    });
  });

  describe('supabase', () => {
    it('con el pooler en modo sesión: postgres, cifrado sin verificar, esquema api', () => {
      expect(ok({ DB_PROVEEDOR: 'supabase', DB_URL: POOLER })).toMatchObject({
        proveedor: 'supabase',
        motor: 'postgres',
        ssl: 'si-sin-verificar',
        esquema: 'api',
      });
    });
    it('con la CA del proveedor pasa a verificar', () => {
      expect(ok({ DB_PROVEEDOR: 'supabase', DB_URL: POOLER, DB_SSL_CA: 'ca.crt' })).toMatchObject({
        ssl: 'si',
        sslCa: 'ca.crt',
      });
    });
    it('DB_SSL explícito gana al preset', () => {
      expect(ok({ DB_PROVEEDOR: 'supabase', DB_URL: POOLER, DB_SSL: 'no' }).ssl).toBe('no');
    });
    it('rechaza la conexión directa (sólo IPv6) y dice cuál copiar', () => {
      const p = problemas({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:clave@db.abcdefgh.supabase.co:5432/postgres',
      });
      expect(p.join(' ')).toMatch(/IPv6.*Session pooler/);
    });
    it('rechaza el modo transacción (6543)', () => {
      const p = problemas({ DB_PROVEEDOR: 'supabase', DB_URL: POOLER.replace(':5432', ':6543') });
      expect(p.join(' ')).toMatch(/modo transacción.*modo sesión.*5432/);
    });
    it('rechaza un usuario sin el id del proyecto', () => {
      const p = problemas({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
      });
      expect(p.join(' ')).toMatch(/postgres\.<id del proyecto>/);
    });
    it('rechaza un servidor que no es de Supabase', () => {
      expect(
        problemas({
          DB_PROVEEDOR: 'supabase',
          DB_URL: 'postgres://postgres.x:y@localhost/db',
        }).join(' '),
      ).toMatch(/pooler\.supabase\.com/);
    });
    it('sin DB_URL, lo pide', () => {
      expect(problemas({ DB_PROVEEDOR: 'supabase' })[0]).toMatch(/Falta DB_URL.*Supabase/);
    });
    it('DB_MOTOR contradictorio', () => {
      expect(problemas({ DB_PROVEEDOR: 'supabase', DB_URL: POOLER, DB_MOTOR: 'mysql' })[0]).toMatch(
        /DB_MOTOR/,
      );
    });
    it('un protocolo equivocado', () => {
      expect(
        problemas({ DB_PROVEEDOR: 'supabase', DB_URL: 'mysql://a:b@x.pooler.supabase.com/db' })[0],
      ).toMatch(/postgres:\/\//);
    });
  });

  describe('neon', () => {
    const url = 'postgres://u:p@ep-cool-123.sa-east-1.aws.neon.tech/neondb';
    it('cifrado y verificado, esquema public', () => {
      expect(ok({ DB_PROVEEDOR: 'neon', DB_URL: url })).toMatchObject({
        motor: 'postgres',
        ssl: 'si',
        esquema: 'public',
      });
    });
    it('rechaza otro servidor', () => {
      expect(problemas({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@localhost/db' })[0]).toMatch(
        /neon\.tech/,
      );
    });
  });

  describe('aiven', () => {
    it('postgres: cifrado sin verificar, y verificado con CA', () => {
      const url = 'postgres://avnadmin:p@pg-1.aivencloud.com:12345/defaultdb';
      expect(ok({ DB_PROVEEDOR: 'aiven-postgres', DB_URL: url })).toMatchObject({
        motor: 'postgres',
        ssl: 'si-sin-verificar',
        esquema: 'public',
      });
      expect(ok({ DB_PROVEEDOR: 'aiven-postgres', DB_URL: url, DB_SSL_CA: 'ca.pem' }).ssl).toBe(
        'si',
      );
    });
    it('mysql: sin esquema', () => {
      const c = ok({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://avnadmin:p@mysql-1.aivencloud.com:12345/defaultdb',
      });
      expect(c).toMatchObject({ motor: 'mysql', esquema: null });
    });
    it('rechaza un servidor que no es de Aiven', () => {
      expect(
        problemas({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:p@localhost:3306/db' })[0],
      ).toMatch(/aivencloud\.com/);
    });
  });

  describe('valores sueltos', () => {
    it('DB_PROVEEDOR desconocido', () => {
      expect(problemas({ DB_PROVEEDOR: 'heroku' })[0]).toMatch(/supabase, neon/);
    });
    it('DB_SSL desconocido', () => {
      expect(problemas({ DB_SSL: 'quizas' })[0]).toMatch(/no, si, si-sin-verificar/);
    });
    it('DB_ESQUEMA con postgres', () => {
      expect(
        ok({ DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h/db', DB_ESQUEMA: 'mi_api' }).esquema,
      ).toBe('mi_api');
    });
    it('DB_ESQUEMA con un nombre peligroso o con otro motor', () => {
      expect(
        problemas({
          DB_MOTOR: 'postgres',
          DB_URL: 'postgres://a:b@h/db',
          DB_ESQUEMA: 'api"; drop',
        })[0],
      ).toMatch(/DB_ESQUEMA/);
      expect(problemas({ DB_ESQUEMA: 'api' })[0]).toMatch(/sólo se usa con PostgreSQL/);
    });
    it('DB_SINCRONIZAR=false', () => {
      expect(ok({ DB_SINCRONIZAR: 'false' }).sincronizar).toBe(false);
    });
  });

  describe('conexionDeUrl decodifica caracteres raros', () => {
    it('una contraseña con @, # y /', () => {
      expect(
        conexionDeUrl('postgres://postgres.abc:p%40ss%23w%2Ford@host.com:5432/mi%20base'),
      ).toEqual({
        host: 'host.com',
        puerto: 5432,
        usuario: 'postgres.abc',
        contrasena: 'p@ss#w/ord',
        base: 'mi base',
      });
    });
    it('sin puerto', () => {
      expect(conexionDeUrl('mysql://u:p@h/db').puerto).toBeUndefined();
    });
  });
});
