import {
  configuracionBase,
  conexionDeUrl,
  motorEfectivo,
  traducirErrorDeConexion,
  type ConfiguracionBase,
} from './proveedores.js';

function ok(r: ReturnType<typeof configuracionBase>): ConfiguracionBase {
  if ('error' in r) throw new Error(`Se esperaba una configuración y dio: ${r.error}`);
  return r;
}
function error(r: ReturnType<typeof configuracionBase>): string {
  if (!('error' in r)) throw new Error('Se esperaba un error');
  return r.error;
}

const SUPABASE = 'postgres://postgres.abcdefghij:clave@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

describe('AGENTS §18.1 — Presets de base de datos', () => {
  it('sin proveedor: todo como en §5.1 (SQLite por defecto)', () => {
    expect(ok(configuracionBase({}))).toEqual({
      motor: 'better-sqlite3',
      proveedor: null,
      url: null,
      ssl: 'no',
      sslCa: null,
      esquema: null,
    });
  });

  it('sin proveedor: postgres con su URL, sin cifrado ni esquema', () => {
    const c = ok(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@localhost:5432/d' }));
    expect(c).toMatchObject({ motor: 'postgres', proveedor: null, ssl: 'no', esquema: null });
  });

  it('sin proveedor: mysql y mariadb piden DB_URL con el ejemplo', () => {
    expect(error(configuracionBase({ DB_MOTOR: 'mysql' }))).toMatch(/DB_URL.*mysql:\/\//);
    expect(error(configuracionBase({ DB_MOTOR: 'oracle' }))).toMatch(/DB_MOTOR/);
  });

  describe('supabase', () => {
    it('la cadena del pooler en modo sesión: postgres, cifrado sin verificar y esquema api', () => {
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: SUPABASE }))).toMatchObject({
        motor: 'postgres',
        proveedor: 'supabase',
        ssl: 'si-sin-verificar',
        esquema: 'api',
      });
    });
    it('pisa a DB_MOTOR', () => {
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_MOTOR: 'better-sqlite3', DB_URL: SUPABASE })).motor).toBe(
        'postgres',
      );
    });
    it('con DB_SSL_CA pasa a verificar', () => {
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: SUPABASE, DB_SSL_CA: '/certs/ca.pem' }))).toMatchObject({
        ssl: 'si',
        sslCa: '/certs/ca.pem',
      });
    });
    it('DB_SSL y DB_ESQUEMA pisan al preset', () => {
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: SUPABASE, DB_SSL: 'no', DB_ESQUEMA: 'mi_api' }))).toMatchObject({
        ssl: 'no',
        esquema: 'mi_api',
      });
    });
    it('falta DB_URL: dice dónde conseguirla', () => {
      expect(error(configuracionBase({ DB_PROVEEDOR: 'supabase' }))).toMatch(/DB_URL.*Session pooler/);
    });
    it('la conexión directa (db.<ref>.supabase.co) se rechaza: sólo IPv6', () => {
      const e = error(
        configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: 'postgres://postgres:clave@db.abcdefghij.supabase.co:5432/postgres' }),
      );
      expect(e).toMatch(/IPv6/);
      expect(e).toMatch(/Session pooler/);
    });
    it('el modo transacción (6543) se rechaza y explica cuál usar', () => {
      const e = error(
        configuracionBase({
          DB_PROVEEDOR: 'supabase',
          DB_URL: 'postgres://postgres.abcdefghij:clave@aws-1-sa-east-1.pooler.supabase.com:6543/postgres',
        }),
      );
      expect(e).toMatch(/modo transacción/);
      expect(e).toMatch(/modo sesión, puerto 5432/);
    });
    it('otro puerto', () => {
      expect(
        error(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: SUPABASE.replace(':5432', ':5433') })),
      ).toMatch(/5432/);
    });
    it('usuario sin el código del proyecto', () => {
      expect(
        error(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: SUPABASE.replace('postgres.abcdefghij', 'postgres') })),
      ).toMatch(/postgres\.<código del proyecto>/);
    });
    it('un host que no es de Supabase', () => {
      expect(
        error(configuracionBase({ DB_PROVEEDOR: 'supabase', DB_URL: 'postgres://postgres.a:b@localhost:5432/d' })),
      ).toMatch(/pooler\.supabase\.com/);
    });
  });

  describe('neon', () => {
    const url = 'postgres://usuario:clave@ep-frio-123.sa-east-1.aws.neon.tech/neondb?sslmode=require';
    it('postgres, cifrado y verificado, esquema public', () => {
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'neon', DB_URL: url }))).toMatchObject({
        motor: 'postgres',
        ssl: 'si',
        esquema: 'public',
      });
    });
    it('host equivocado', () => {
      expect(error(configuracionBase({ DB_PROVEEDOR: 'neon', DB_URL: SUPABASE }))).toMatch(/\.neon\.tech/);
    });
  });

  describe('aiven', () => {
    it('aiven-postgres: cifrado sin verificar (o verificado con CA)', () => {
      const url = 'postgres://avnadmin:clave@pg-x.a.aivencloud.com:12345/defaultdb';
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'aiven-postgres', DB_URL: url }))).toMatchObject({
        motor: 'postgres',
        ssl: 'si-sin-verificar',
        esquema: 'public',
      });
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'aiven-postgres', DB_URL: url, DB_SSL_CA: 'ca.pem' })).ssl).toBe('si');
    });
    it('aiven-mysql: motor mysql y sin esquema (ni aunque se pida)', () => {
      const url = 'mysql://avnadmin:clave@mysql-x.a.aivencloud.com:12345/defaultdb';
      expect(ok(configuracionBase({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: url, DB_ESQUEMA: 'api' }))).toMatchObject({
        motor: 'mysql',
        ssl: 'si-sin-verificar',
        esquema: null,
      });
    });
    it('host equivocado', () => {
      expect(error(configuracionBase({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://a:b@localhost:3306/d' }))).toMatch(
        /\.aivencloud\.com/,
      );
    });
  });

  describe('errores de configuración', () => {
    it('DB_PROVEEDOR desconocido lista los válidos', () => {
      expect(error(configuracionBase({ DB_PROVEEDOR: 'heroku' }))).toMatch(/supabase, neon, aiven-postgres, aiven-mysql/);
    });
    it('DB_SSL desconocido explica las tres opciones', () => {
      expect(error(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h/d', DB_SSL: 'quizas' }))).toMatch(
        /no, si, si-sin-verificar/,
      );
    });
    it('DB_ESQUEMA con caracteres raros (se usa como identificador)', () => {
      expect(error(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h/d', DB_ESQUEMA: 'x; drop' }))).toMatch(
        /DB_ESQUEMA/,
      );
    });
    it('DB_URL que no es una URL explica cómo escribir la contraseña', () => {
      expect(error(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'esto no es una url' }))).toMatch(/%40/);
    });
    it('el protocolo tiene que corresponder al motor', () => {
      expect(error(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'mysql://a:b@h/d' }))).toMatch(/postgres:\/\//);
    });
  });

  it('DB_ESQUEMA sólo vale para PostgreSQL', () => {
    expect(ok(configuracionBase({ DB_MOTOR: 'mysql', DB_URL: 'mysql://a:b@h/d', DB_ESQUEMA: 'api' })).esquema).toBeNull();
    expect(ok(configuracionBase({ DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h/d', DB_ESQUEMA: 'api' })).esquema).toBe('api');
  });
});

describe('AGENTS §18.1 — DB_URL se parsea con URL y se decodifica', () => {
  it('contraseña con caracteres raros', () => {
    expect(conexionDeUrl('postgres://postgres.abc:p%40ss%2Fw%23rd%3A1@host.com:6000/mi_base', 'postgres')).toEqual({
      host: 'host.com',
      puerto: 6000,
      usuario: 'postgres.abc',
      contrasena: 'p@ss/w#rd:1',
      base: 'mi_base',
    });
  });
  it('puertos por defecto', () => {
    expect(conexionDeUrl('postgres://a:b@h/d', 'postgres').puerto).toBe(5432);
    expect(conexionDeUrl('mysql://a:b@h/d', 'mysql').puerto).toBe(3306);
  });
});

describe('motorEfectivo', () => {
  it('el proveedor manda; después DB_MOTOR; después SQLite', () => {
    expect(motorEfectivo({ DB_PROVEEDOR: 'aiven-mysql', DB_MOTOR: 'postgres' })).toBe('mysql');
    expect(motorEfectivo({ DB_MOTOR: 'mariadb' })).toBe('mariadb');
    expect(motorEfectivo({})).toBe('better-sqlite3');
  });
});

describe('AGENTS §18.1 — Errores de conexión en castellano', () => {
  it.each([
    [new Error('self-signed certificate in certificate chain'), 'si', /DB_SSL=si-sin-verificar.*DB_SSL_CA/],
    [new Error('unable to verify the first certificate'), 'no', /DB_SSL=si-sin-verificar/],
    [new Error('password authentication failed for user "x"'), 'no', /usuario o la contraseña/],
    [new Error("Access denied for user 'x'@'h'"), 'no', /usuario o la contraseña/],
    [new Error('bind message supplies 2 parameters, prepared statement "x" does not exist'), 'no', /modo transacción/],
    [new Error('connect ENETUNREACH 2600::1:5432'), 'no', /pooler|Session pooler/],
    [new Error('getaddrinfo ENOTFOUND db.example.com'), 'no', /No se encontró el servidor/],
    [new Error('connect ECONNREFUSED 127.0.0.1:5432'), 'no', /no responde/],
    [new Error('no pg_hba.conf entry for host, no encryption'), 'no', /DB_SSL=si-sin-verificar/],
  ] as const)('%s', (falla, ssl, esperado) => {
    expect(traducirErrorDeConexion(falla, ssl)).toMatch(esperado);
  });
  it('un error que no reconoce devuelve null', () => {
    expect(traducirErrorDeConexion(new Error('algo raro'))).toBeNull();
  });
});
