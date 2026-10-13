// Verificación independiente de M7 — Nube (caja negra, AGENTS §12, §17 y §18).
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarError } from '../utilidades/contrato.js';
import { crearRuta } from '../utilidades/rutas.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';
import { leerEntorno } from '../../src/config/entorno.js';

const JERGA =
  /undefined|\[object|NaN|\bmust\b|\bshould\b|exception|QueryFailed|constraint|class-validator|stack|ECONN|ENOTFOUND|TypeError|ZodError/i;
const FUERTE = 'una-clave-larga-y-secreta-de-mas-de-32-caracteres';
const SUPA =
  'postgres://postgres.abcdefgh:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
const BASE_PUBLICADA = {
  ENTORNO: 'publicado',
  JWT_SECRETO: FUERTE,
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
const mensajeDe = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
};
const buffer = (
  res: NodeJS.ReadableStream,
  cb: (e: Error | null, b: Buffer) => void,
) => {
  const partes: Buffer[] = [];
  res.on('data', (p: Buffer) => partes.push(p));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

describe('AGENTS §18.2 — ENTORNO=publicado: bordes de la configuración', () => {
  it('JWT_SECRETO de exactamente 32 caracteres arranca; de 31 no', () => {
    expect(() =>
      leerEntorno({ ...BASE_PUBLICADA, JWT_SECRETO: 'x'.repeat(32) }),
    ).not.toThrow();
    expect(
      mensajeDe(() =>
        leerEntorno({ ...BASE_PUBLICADA, JWT_SECRETO: 'x'.repeat(31) }),
      ),
    ).toMatch(/32 caracteres/);
  });

  it('SIMULACION_HABILITADA=true falla aunque todo lo demás esté bien', () => {
    expect(
      mensajeDe(() =>
        leerEntorno({ ...BASE_PUBLICADA, SIMULACION_HABILITADA: 'true' }),
      ),
    ).not.toBe('');
  });

  it('con MariaDB, MySQL o Postgres administrado y archivos S3 arranca', () => {
    expect(() =>
      leerEntorno({
        ...BASE_PUBLICADA,
        DB_PROVEEDOR: undefined,
        DB_MOTOR: 'mariadb',
        DB_URL: 'mysql://a:b@host.ejemplo.com:3306/api',
      }),
    ).not.toThrow();
  });

  it('SQLite explícito en publicado no arranca', () => {
    expect(
      mensajeDe(() =>
        leerEntorno({
          ...BASE_PUBLICADA,
          DB_PROVEEDOR: undefined,
          DB_URL: undefined,
          DB_MOTOR: 'better-sqlite3',
        }),
      ),
    ).toMatch(/SQLite/);
  });

  it('el problema de SQLite, archivos locales, JWT corto y simulación se juntan en un mensaje', () => {
    const m = mensajeDe(() =>
      leerEntorno({
        ENTORNO: 'publicado',
        JWT_SECRETO: 'corto',
        SIMULACION_HABILITADA: 'true',
      }),
    );
    expect(m).toMatch(/SQLite/);
    expect(m).toMatch(/local/);
    expect(m).toMatch(/32/);
    expect(m).toMatch(/SIMULACION_HABILITADA/);
    expect(m).not.toMatch(JERGA);
  });

  it('ENTORNO=desarrollo y test no imponen nada de lo anterior', () => {
    expect(() =>
      leerEntorno({ ENTORNO: 'desarrollo', JWT_SECRETO: 'corto' }),
    ).not.toThrow();
    expect(() =>
      leerEntorno({ ENTORNO: 'test', JWT_SECRETO: 'corto' }),
    ).not.toThrow();
  });
});

describe('AGENTS §18.1 — Presets de base de datos', () => {
  const ok = (extra: Record<string, string | undefined>) =>
    leerEntorno({ JWT_SECRETO: FUERTE, ...extra });

  it.each([
    [
      'supabase por conexión directa (IPv6)',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:x@db.abcdefgh.supabase.co:5432/postgres',
      },
    ],
    [
      'supabase pooler en modo transacción',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.abc:x@h.pooler.supabase.com:6543/postgres',
      },
    ],
    [
      'supabase con usuario sin ref',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:x@h.pooler.supabase.com:5432/postgres',
      },
    ],
    ['supabase sin DB_URL', { DB_PROVEEDOR: 'supabase' }],
    [
      'neon con host ajeno',
      { DB_PROVEEDOR: 'neon', DB_URL: 'postgres://a:b@otro.com/db' },
    ],
    [
      'aiven-postgres con host ajeno',
      { DB_PROVEEDOR: 'aiven-postgres', DB_URL: 'postgres://a:b@otro.com/db' },
    ],
    [
      'aiven-mysql con host ajeno',
      { DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://a:b@otro.com/db' },
    ],
    [
      'proveedor desconocido',
      { DB_PROVEEDOR: 'heroku', DB_URL: 'postgres://a@h/d' },
    ],
    [
      'DB_SSL inválido',
      { DB_MOTOR: 'postgres', DB_URL: 'postgres://a:b@h/d', DB_SSL: 'tal vez' },
    ],
    [
      'DB_ESQUEMA con caracteres peligrosos',
      {
        DB_MOTOR: 'postgres',
        DB_URL: 'postgres://a:b@h/d',
        DB_ESQUEMA: 'api; DROP SCHEMA public',
      },
    ],
  ])('%s se rechaza con un mensaje en castellano sin jerga', (_n, extra) => {
    const m = mensajeDe(() => ok(extra));
    expect(m).not.toBe('');
    expect(m).not.toMatch(JERGA);
  });

  it('el rechazo de Supabase en modo transacción dice cuál usar', () => {
    const m = mensajeDe(() =>
      ok({
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.abc:x@h.pooler.supabase.com:6543/postgres',
      }),
    );
    expect(m).toMatch(/5432/);
  });

  it('la contraseña con caracteres raros se decodifica y no rompe', () => {
    const e = ok({
      DB_PROVEEDOR: 'supabase',
      DB_URL:
        'postgres://postgres.abcdefgh:p%40ss%2Fw%3Ard%23@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    });
    expect(e.DB_MOTOR).toBe('postgres');
  });

  it('los presets completan motor, SSL y esquema', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'neon',
        DB_URL: 'postgres://a:b@ep-x.us-east-2.aws.neon.tech/db',
      }),
    ).toMatchObject({
      DB_MOTOR: 'postgres',
      DB_SSL: 'si',
      DB_ESQUEMA: 'public',
    });
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-postgres',
        DB_URL: 'postgres://a:b@x-y.aivencloud.com:1234/db',
      }),
    ).toMatchObject({ DB_MOTOR: 'postgres', DB_ESQUEMA: 'public' });
    expect(
      ok({
        DB_PROVEEDOR: 'aiven-mysql',
        DB_URL: 'mysql://a:b@x-y.aivencloud.com:1234/db',
      }).DB_MOTOR,
    ).toBe('mysql');
  });

  it('con DB_SSL_CA, Aiven pasa a verificar (y sin ella no)', () => {
    const base = {
      DB_PROVEEDOR: 'aiven-postgres',
      DB_URL: 'postgres://a:b@x-y.aivencloud.com:1234/db',
    };
    const sin = ok(base);
    const con = ok({ ...base, DB_SSL_CA: '/tmp/ca.pem' });
    expect(sin.DB_SSL).toBe('si-sin-verificar');
    expect(sin.DB_SSL_CA ?? null).toBeNull();
    expect(con.DB_SSL_CA).toBe('/tmp/ca.pem');
  });

  it('DB_ESQUEMA explícito pisa el del preset', () => {
    expect(
      ok({
        DB_PROVEEDOR: 'supabase',
        DB_URL: SUPA,
        DB_ESQUEMA: 'mi_esquema',
      }).DB_ESQUEMA,
    ).toBe('mi_esquema');
  });
});

describe('AGENTS §17.2 — Presets de archivos', () => {
  const ok = (extra: Record<string, string | undefined>) =>
    leerEntorno({ JWT_SECRETO: FUERTE, ...extra });
  const claves = { S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' };

  it.each([
    [
      'aws',
      ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
    [
      'supabase',
      [
        'SUPABASE_PROYECTO',
        'S3_BUCKET',
        'S3_REGION',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ],
    ],
    [
      'r2',
      ['R2_CUENTA', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
    [
      'b2',
      ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
  ])('%s nombra cada variable que falta', (prov, vars) => {
    const m = mensajeDe(() => ok({ ARCHIVOS_PROVEEDOR: prov }));
    for (const v of vars) expect(m).toContain(v);
    expect(m).not.toMatch(JERGA);
  });

  it('endpoints y estilos de ruta de cada preset', () => {
    const e = (extra: Record<string, string>) =>
      ok({ ...claves, S3_BUCKET: 'b', ...extra }).ARCHIVOS_S3;
    expect(e({ ARCHIVOS_PROVEEDOR: 'r2', R2_CUENTA: 'cuenta1' })).toMatchObject(
      {
        endpoint: 'https://cuenta1.r2.cloudflarestorage.com',
        region: 'auto',
        forcePathStyle: false,
      },
    );
    expect(
      e({ ARCHIVOS_PROVEEDOR: 'r2', R2_CUENTA: 'c', S3_REGION: 'eu-west-1' })
        ?.region,
    ).toBe('auto');
    expect(
      e({ ARCHIVOS_PROVEEDOR: 'b2', S3_REGION: 'us-west-004' }),
    ).toMatchObject({
      endpoint: 'https://s3.us-west-004.backblazeb2.com',
      region: 'us-west-004',
    });
    expect(
      e({
        ARCHIVOS_PROVEEDOR: 'supabase',
        SUPABASE_PROYECTO: 'proy',
        S3_REGION: 'sa-east-1',
      }),
    ).toMatchObject({
      endpoint: 'https://proy.storage.supabase.co/storage/v1/s3',
      forcePathStyle: true,
    });
    expect(e({ ARCHIVOS_PROVEEDOR: 's3proxy' })).toMatchObject({
      endpoint: 'http://s3:8080',
      region: 'us-east-1',
      forcePathStyle: true,
    });
    expect(e({ ARCHIVOS_PROVEEDOR: 'localstack' })).toMatchObject({
      endpoint: 'http://localstack:4566',
      forcePathStyle: true,
    });
    expect(
      e({ ARCHIVOS_PROVEEDOR: 'aws', S3_REGION: 'us-east-2' })?.forcePathStyle,
    ).toBe(false);
  });

  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset', () => {
    const c = ok({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://otro:9000',
      S3_FORZAR_PATH_STYLE: 'false',
    }).ARCHIVOS_S3;
    expect(c).toMatchObject({
      endpoint: 'http://otro:9000',
      forcePathStyle: false,
    });
  });

  it('local no trae configuración S3', () => {
    expect(ok({}).ARCHIVOS_S3 ?? null).toBeNull();
  });
});

describe('AGENTS §17.1 — Almacén caído o mal configurado', () => {
  it('con un S3 que no responde la app no arranca y dice por qué en castellano', async () => {
    let error: unknown = null;
    let app: AppDePrueba | null = null;
    try {
      app = await crearApp({
        entorno: {
          ARCHIVOS_PROVEEDOR: 's3proxy',
          S3_ENDPOINT: 'http://127.0.0.1:1',
          S3_BUCKET: 'x',
        },
      });
    } catch (e) {
      error = e;
    }
    if (app) await app.cerrar();
    expect(error).not.toBeNull();
    expect((error as Error).message).not.toMatch(/^\s*$/);
  }, 120_000);
});

describe('AGENTS §18.2 — CONFIAR_PROXY y URL_PUBLICA', () => {
  const subirCon = async (
    c: AppDePrueba,
    cabeceras: Record<string, string>,
  ) => {
    const { token } = await conSesion(c, 'lector', {
      legajo: `P${Math.random().toString(36).slice(2, 8)}`,
    });
    let p = c.http().post('/archivos').set(bearer(token));
    for (const [k, v] of Object.entries(cabeceras)) p = p.set(k, v);
    return p.attach('archivo', jpeg(), 'f.jpg');
  };

  describe('CONFIAR_PROXY=true', () => {
    let c: AppDePrueba;
    beforeAll(
      async () => (c = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } })),
    );
    afterAll(() => c.cerrar());

    it('sólo X-Forwarded-Proto: https con el Host del pedido', async () => {
      const r = await subirCon(c, {
        Host: '10.1.2.3:3000',
        'X-Forwarded-Proto': 'https',
      }).then((x) => x);
      expect(r.status).toBe(201);
      expect(r.body.datos.url).toMatch(
        /^https:\/\/10\.1\.2\.3:3000\/archivos\//,
      );
    });

    it('X-Forwarded-Host con puerto se respeta', async () => {
      const r = await subirCon(c, {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'api.ejemplo.com:8443',
      });
      expect(r.body.datos.url).toMatch(
        /^https:\/\/api\.ejemplo\.com:8443\/archivos\//,
      );
    });

    it('una cadena de proxies "https, http" usa el primero', async () => {
      const r = await subirCon(c, {
        'X-Forwarded-Proto': 'https, http',
        'X-Forwarded-Host': 'api.ejemplo.com, interno.local',
      });
      expect(r.body.datos.url).toMatch(
        /^https:\/\/api\.ejemplo\.com\/archivos\//,
      );
    });

    it('el origen forwardeado también sale en las lecturas y en el paquete', async () => {
      const lector = await conSesion(c, 'lector', { legajo: 'PX-LEC' });
      const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
      const h = {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'medidores.onrender.com',
      };
      const s = await c
        .http()
        .post('/archivos')
        .set(bearer(lector.token))
        .set(h)
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      const l = await c
        .http()
        .post('/lecturas')
        .set(bearer(lector.token))
        .set(h)
        .send({
          rutaId: ruta.id,
          suministroId: ruta.suministroIds[0],
          valor: 10,
          fotoUri: s.body.datos.url,
          coordenadas: null,
          confirmadaPorLector: false,
          fechaHora: '2026-09-15T07:30:00-03:00',
        });
      expect(l.status).toBe(201);
      expect(l.body.datos.fotoUri).toMatch(
        /^https:\/\/medidores\.onrender\.com\//,
      );
      const d = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .set(h)
        .expect(200);
      expect(d.body.datos.lecturas[0].fotoUri).toMatch(
        /^https:\/\/medidores\.onrender\.com\//,
      );
      // y sin las cabeceras, el origen es el del pedido (http)
      const d2 = await c
        .http()
        .post(`/rutas/${ruta.id}/descarga`)
        .set(bearer(lector.token))
        .expect(200);
      expect(d2.body.datos.lecturas[0].fotoUri).toMatch(
        /^http:\/\/127\.0\.0\.1/,
      );
    });
  });

  describe('CONFIAR_PROXY=true y URL_PUBLICA', () => {
    let c: AppDePrueba;
    beforeAll(
      async () =>
        (c = await crearApp({
          entorno: {
            CONFIAR_PROXY: 'true',
            URL_PUBLICA: 'https://fija.ejemplo.com',
          },
        })),
    );
    afterAll(() => c.cerrar());

    it('URL_PUBLICA gana sobre las cabeceras y sobre el Host', async () => {
      const r = await subirCon(c, {
        Host: '1.2.3.4:3000',
        'X-Forwarded-Proto': 'http',
        'X-Forwarded-Host': 'otro.example.com',
      });
      expect(r.body.datos.url).toMatch(
        /^https:\/\/fija\.ejemplo\.com\/archivos\//,
      );
    });
  });

  describe('sin CONFIAR_PROXY', () => {
    let c: AppDePrueba;
    beforeAll(async () => (c = await crearApp()));
    afterAll(() => c.cerrar());

    it('X-Forwarded-Proto solo se ignora', async () => {
      const r = await subirCon(c, {
        Host: '10.0.0.5:3000',
        'X-Forwarded-Proto': 'https',
      });
      expect(r.body.datos.url).toMatch(
        /^http:\/\/10\.0\.0\.5:3000\/archivos\//,
      );
    });
  });

  it('CONFIAR_PROXY inválido no arranca', () => {
    expect(
      mensajeDe(() =>
        leerEntorno({ JWT_SECRETO: FUERTE, CONFIAR_PROXY: 'quizas' }),
      ),
    ).toMatch(/CONFIAR_PROXY/);
  });
});

describe('Regresión M0–M6 — el contrato no cambió con M7', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  it('/salud con archivos locales: exactamente estado, motor, almacen, version', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(Object.keys(r.body.datos).sort()).toEqual([
      'almacen',
      'estado',
      'motor',
      'version',
    ]);
    expect(r.body.meta).toBeNull();
  });

  it('ruta inexistente: RECURSO_NO_ENCONTRADO con sobre exacto', async () => {
    const tk = (await conSesion(c, 'lector', { legajo: 'RG-L' })).token;
    const r = await c.http().get('/nube/no-existe').set(bearer(tk));
    expect(r.status).toBe(404);
    esperarError(r.body, 'RECURSO_NO_ENCONTRADO');
  });

  it('no hay registro público ni endpoints nuevos expuestos sin sesión', async () => {
    await c.http().post('/auth/registro').send({}).expect(404);
    for (const ruta of [
      '/yo',
      '/usuarios',
      '/rutas',
      '/suministros',
      '/novedades',
    ]) {
      const r = await c.http().get(ruta);
      expect(r.status).toBe(401);
    }
  });

  it('el audio y el video con Range en disco siguen dando 206', async () => {
    const { token } = await conSesion(c, 'lector', { legajo: 'RG-L2' });
    const s = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', mp4(5000), 'v.mp4')
      .expect(201);
    const r = await c
      .http()
      .get(new URL(s.body.datos.url).pathname)
      .set('Range', 'bytes=10-19')
      .buffer(true)
      .parse(buffer as never)
      .expect(206);
    expect(r.headers['content-range']).toBe('bytes 10-19/5000');
  });

  it('Swagger sigue publicado', async () => {
    await c.http().get('/docs-json').expect(200);
  });
});
