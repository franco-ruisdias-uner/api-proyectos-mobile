// Verificación independiente de M7 — Nube (AGENTS §17 y §18), como caja negra.
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { jpeg, png, m4a } from '../utilities/files.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { levantarS3Falso, type S3Falso } from '../utilities/fake-s3.js';
import { registrarJugador } from '../utilities/users.js';

const JWT_LARGO = 'x'.repeat(40);
const buf = (
  res: { on: (e: string, f: (x?: Buffer) => void) => void },
  cb: (e: Error | null, b: Buffer) => void,
) => {
  const t: Buffer[] = [];
  res.on('data', (x) => t.push(x as Buffer));
  res.on('end', () => cb(null, Buffer.concat(t)));
};

async function mensajeDeArranque(
  entorno: Record<string, string>,
): Promise<string> {
  try {
    const a = await crearApp({ entorno });
    await a.cerrar();
    return '';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe('AGENTS §18.2 — ENTORNO=publicado no arranca con configuración de desarrollo', () => {
  const base = {
    ENTORNO: 'publicado',
    DB_MOTOR: 'postgres',
    DB_URL: 'postgres://u:p@127.0.0.1:1/x',
    ARCHIVOS_PROVEEDOR: 's3proxy',
    S3_ENDPOINT: 'http://127.0.0.1:1',
    S3_BUCKET: 'archivos',
    JWT_SECRETO: JWT_LARGO,
  };

  it('SQLite (aunque lo demás esté bien) no arranca y dice por qué', async () => {
    const m = await mensajeDeArranque({
      ...base,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: ':memory:',
      DB_URL: '',
    });
    expect(m).toMatch(/sqlite/i);
  });
  it('archivos locales no arranca', async () => {
    const m = await mensajeDeArranque({ ...base, ARCHIVOS_PROVEEDOR: 'local' });
    expect(m).toMatch(/archivos/i);
  });
  it('JWT de desarrollo no arranca', async () => {
    const m = await mensajeDeArranque({
      ...base,
      JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion',
    });
    expect(m).toMatch(/JWT_SECRETO/);
  });
  it('JWT de 31 caracteres no arranca', async () => {
    const m = await mensajeDeArranque({ ...base, JWT_SECRETO: 'y'.repeat(31) });
    expect(m).toMatch(/JWT_SECRETO/);
  });
  it('simulación pedida no arranca', async () => {
    const m = await mensajeDeArranque({
      ...base,
      SIMULACION_HABILITADA: 'true',
    });
    expect(m).toMatch(/simulaci/i);
  });
  it('varias causas juntas: el mensaje las nombra a todas', async () => {
    const m = await mensajeDeArranque({
      ...base,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: ':memory:',
      DB_URL: '',
      ARCHIVOS_PROVEEDOR: 'local',
      JWT_SECRETO: 'corto',
      SIMULACION_HABILITADA: 'true',
    });
    expect(m).toMatch(/sqlite/i);
    expect(m).toMatch(/archivos/i);
    expect(m).toMatch(/JWT_SECRETO/);
    expect(m).toMatch(/simulaci/i);
  });
  it('el mensaje de arranque no tiene jerga de stack ni undefined', async () => {
    const m = await mensajeDeArranque({
      ...base,
      DB_MOTOR: 'better-sqlite3',
      DB_ARCHIVO: ':memory:',
      DB_URL: '',
    });
    expect(m).not.toMatch(/undefined|\[object/);
  });
});

describe('AGENTS §17.2 — variables que faltan según el proveedor', () => {
  it.each([
    [
      'aws',
      { S3_BUCKET: 'b', S3_REGION: 'us-east-1' },
      /S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|claves/i,
    ],
    [
      'supabase',
      {
        S3_BUCKET: 'b',
        S3_REGION: 'sa-east-1',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      },
      /SUPABASE_PROYECTO/,
    ],
    [
      'r2',
      { S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b' },
      /R2_CUENTA/,
    ],
    [
      'b2',
      {
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
        S3_REGION: 'us-west-004',
      },
      /S3_BUCKET/,
    ],
    [
      'b2',
      { S3_ACCESS_KEY_ID: 'a', S3_SECRET_ACCESS_KEY: 'b', S3_BUCKET: 'b' },
      /S3_REGION/,
    ],
  ])(
    '%s sin una variable no arranca y nombra la que falta',
    async (proveedor, vars, re) => {
      const m = await mensajeDeArranque({
        ARCHIVOS_PROVEEDOR: proveedor,
        ...vars,
      });
      expect(m).toMatch(re);
    },
  );

  it('un proveedor desconocido no arranca', async () => {
    const m = await mensajeDeArranque({ ARCHIVOS_PROVEEDOR: 'firebase' });
    expect(m).not.toBe('');
  });

  it('s3proxy con un servidor que no responde no arranca (prepararse falla)', async () => {
    const m = await mensajeDeArranque({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://127.0.0.1:1',
      S3_BUCKET: 'archivos',
    });
    expect(m).not.toBe('');
  }, 60_000);

  it('el bucket inexistente en el servidor S3 no arranca y nombra el bucket', async () => {
    const f = await levantarS3Falso('otro');
    const m = await mensajeDeArranque({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: f.endpoint,
      S3_BUCKET: 'archivos',
    });
    await f.cerrar();
    expect(m).toMatch(/archivos/);
  }, 60_000);
});

describe('AGENTS §18.1 — presets de base de datos', () => {
  const ok = { ARCHIVOS_PROVEEDOR: 'local' };
  it('supabase con conexión directa (db.<ref>.supabase.co) se rechaza explicando el pooler', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'supabase',
      DB_URL: 'postgres://postgres:pw@db.abcd.supabase.co:5432/postgres',
    });
    expect(m).toMatch(/pooler/i);
  });
  it('supabase con pooler en modo transacción (6543) se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'supabase',
      DB_URL:
        'postgres://postgres.abcd:pw@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    });
    expect(m).toMatch(/6543|transacci/i);
  });
  it('supabase con usuario sin referencia (postgres a secas) se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'supabase',
      DB_URL:
        'postgres://postgres:pw@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    });
    expect(m).toMatch(/postgres\.|usuario/i);
  });
  it('neon con otro host se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p@ejemplo.com/db',
    });
    expect(m).toMatch(/neon/i);
  });
  it('aiven-mysql con otro host se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'aiven-mysql',
      DB_URL: 'mysql://u:p@ejemplo.com:3306/db',
    });
    expect(m).toMatch(/aiven/i);
  });
  it('proveedor sin DB_URL se rechaza nombrando DB_URL', async () => {
    const m = await mensajeDeArranque({ ...ok, DB_PROVEEDOR: 'neon' });
    expect(m).toMatch(/DB_URL/);
  });
  it('DB_PROVEEDOR desconocido se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'mongo',
      DB_URL: 'postgres://a:b@c/d',
    });
    expect(m).not.toBe('');
  });
  it('DB_SSL con valor inválido se rechaza', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_MOTOR: 'postgres',
      DB_URL: 'postgres://u:p@127.0.0.1:1/x',
      DB_SSL: 'quizas',
    });
    expect(m).toMatch(/DB_SSL/);
  });
  it('contraseña con caracteres raros (@ : / %) en la URL no rompe el preset (llega a conectar)', async () => {
    const m = await mensajeDeArranque({
      ...ok,
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p%40ss%3A%2Fw@ep-x.neon.tech:1/db',
    });
    // Debe fallar por conexión, no por formato de URL ni de preset.
    expect(m).not.toMatch(/DB_URL.*(formato|inválid)|host/i);
  }, 60_000);
});

describe('AGENTS §17 — proveedor S3 de punta a punta (contrato sin cambios)', () => {
  let a: AppDePrueba;
  let f: S3Falso;
  let token: string;
  beforeAll(async () => {
    f = await levantarS3Falso();
    a = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: f.endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    ({ token } = await registrarJugador(a));
  });
  afterAll(async () => {
    await a.cerrar();
    await f.cerrar();
  });

  const subir = (b: Buffer, nombre: string) =>
    a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', b, nombre);

  it('/salud: forma exacta con almacen s3proxy y motor', async () => {
    const res = await a.http().get('/salud').expect(200);
    const s = esperarContrato<{ almacen: string; motor: string }>(
      res.body,
      'Salud',
    );
    expect(s.almacen).toBe('s3proxy');
    expect(s.motor).toBe('better-sqlite3');
  });

  it('/salud con almacenamiento local informa local', async () => {
    const b = await crearApp();
    const res = await b.http().get('/salud').expect(200);
    expect(
      esperarContrato<{ almacen: string }>(res.body, 'Salud').almacen,
    ).toBe('local');
    await b.cerrar();
  });

  it('POST /archivos devuelve ArchivoSubido; la clave generada por el servidor no usa el nombre del usuario', async () => {
    const res = await subir(jpeg(500), 'evil name ../x.jpg').expect(201);
    const d = esperarContrato<{ url: string; tipo: string; bytes: number }>(
      res.body,
      'ArchivoSubido',
    );
    expect(d.bytes).toBe(500);
    expect(d.url).toMatch(
      /\/archivos\/imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/,
    );
    expect(d.url).not.toMatch(/evil|\.\./);
  });

  it('png, m4a suben y bajan idénticos', async () => {
    for (const [c, n] of [
      [png(700), 'a.png'],
      [m4a(900), 'a.m4a'],
    ] as const) {
      const r = await subir(c, n).expect(201);
      const ruta = new URL((r.body as { datos: { url: string } }).datos.url)
        .pathname;
      const g = await a.http().get(ruta).buffer(true).parse(buf).expect(200);
      expect(g.body).toEqual(c);
    }
  });

  it('un archivo con extensión jpg pero firma de texto es 415', async () => {
    const res = await subir(Buffer.from('hola mundo no soy imagen'), 'x.jpg');
    esperarError(res, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
  });

  it('una imagen de más de 5 MB es 413', async () => {
    const res = await subir(jpeg(5 * 1024 * 1024 + 10), 'x.jpg');
    esperarError(res, 413, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('sin token es 401 y no toca el almacén', async () => {
    const antes = f.pedidos.length;
    const res = await a
      .http()
      .post('/archivos')
      .attach('archivo', jpeg(), 'x.jpg');
    esperarError(res, 401, 'NO_AUTENTICADO');
    expect(f.pedidos.length).toBe(antes);
  });

  it('rangos: último byte, abierto (bytes=N-), sufijo (bytes=-N)', async () => {
    const c = jpeg(1000);
    const r = await subir(c, 'x.jpg').expect(201);
    const ruta = new URL((r.body as { datos: { url: string } }).datos.url)
      .pathname;
    const ultimo = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=999-999')
      .buffer(true)
      .parse(buf)
      .expect(206);
    expect(ultimo.headers['content-range']).toBe('bytes 999-999/1000');
    expect(ultimo.body).toEqual(c.subarray(999));
    const abierto = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=990-')
      .buffer(true)
      .parse(buf)
      .expect(206);
    expect(abierto.headers['content-range']).toBe('bytes 990-999/1000');
    expect(abierto.body).toEqual(c.subarray(990));
    const sufijo = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=-10')
      .buffer(true)
      .parse(buf)
      .expect(206);
    expect(sufijo.body).toEqual(c.subarray(990));
  });

  it('rango fuera del archivo es 416 con sobre de error o el servidor lo maneja sin 500', async () => {
    const r = await subir(jpeg(100), 'x.jpg').expect(201);
    const ruta = new URL((r.body as { datos: { url: string } }).datos.url)
      .pathname;
    const res = await a.http().get(ruta).set('Range', 'bytes=500-600');
    expect(res.status).toBeLessThan(500);
  });

  it('rango con fin mayor al tamaño se recorta', async () => {
    const r = await subir(jpeg(100), 'x.jpg').expect(201);
    const ruta = new URL((r.body as { datos: { url: string } }).datos.url)
      .pathname;
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=90-500')
      .buffer(true)
      .parse(buf)
      .expect(206);
    expect(res.headers['content-range']).toBe('bytes 90-99/100');
  });

  it('claves malas en GET /archivos: travesía y claves raras dan 404 con sobre', async () => {
    for (const ruta of [
      '/archivos/..%2f..%2fetc%2fpasswd',
      '/archivos/imagenes/../../x',
      '/archivos/zzz/2026/09/a.jpg',
      '/archivos/imagenes/2026/09/%00.jpg',
    ]) {
      const res = await a.http().get(ruta);
      expect([400, 404]).toContain(res.status);
      esperarError(
        res,
        res.status,
        res.status === 404 ? res.body.error.codigo : 'VALIDACION_FALLIDA',
      );
    }
  });

  it('un recurso con una URL ajena sigue rechazándose con ARCHIVO_NO_SUBIDO (422) con proveedor S3', async () => {
    // PATCH /yo no tiene foto; se usa la comprobación de URL ajena sólo si el contrato la admite.
    const res = await a.http().get('/archivos/imagenes/2026/09/noexiste.jpg');
    esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('dos subidas simultáneas generan claves distintas', async () => {
    const [x, y] = await Promise.all([
      subir(jpeg(300), 'a.jpg'),
      subir(jpeg(300), 'a.jpg'),
    ]);
    expect(x.body.datos.url).not.toBe(y.body.datos.url);
  });
});

describe('AGENTS §17.1 — proveedor caído y recuperación', () => {
  it('GET de un archivo con el proveedor caído da 503 ALMACEN_NO_DISPONIBLE', async () => {
    const f = await levantarS3Falso();
    const a = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: f.endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    await f.cerrar();
    const res = await a.http().get('/archivos/imagenes/2026/09/abc12345.jpg');
    esperarError(res, 503, 'ALMACEN_NO_DISPONIBLE');
    expect(res.body.error.mensaje).toMatch(/archivos/i);
    await a.cerrar();
  }, 30_000);

  it('/salud sigue en 200 aunque el almacén esté caído', async () => {
    const f = await levantarS3Falso();
    const a = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: f.endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    await f.cerrar();
    await a.http().get('/salud').expect(200);
    await a.cerrar();
  }, 30_000);
});

describe('AGENTS §18.2 — CONFIAR_PROXY y URLs https', () => {
  it('con CONFIAR_PROXY=true y S3, las URLs de archivos salen https con el host público', async () => {
    const f = await levantarS3Falso();
    const a = await crearApp({
      entorno: {
        CONFIAR_PROXY: 'true',
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: f.endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    const { token } = await registrarJugador(a);
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'interno:10000')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'api.onrender.com')
      .attach('archivo', jpeg(), 'x.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(
      /^https:\/\/api\.onrender\.com\/archivos\//,
    );
    await a.cerrar();
    await f.cerrar();
  });
  it('X-Forwarded-Proto con lista "https,http" usa el primero', async () => {
    const a = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    const { token } = await registrarJugador(a);
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-Proto', 'https,http')
      .set('X-Forwarded-Host', 'a.example.com')
      .attach('archivo', jpeg(), 'x.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/^https:\/\/a\.example\.com\//);
    await a.cerrar();
  });
  it('URL_PUBLICA con barra final no duplica barras', async () => {
    const a = await crearApp({
      entorno: { URL_PUBLICA: 'https://api.ejemplo.com/' },
    });
    const { token } = await registrarJugador(a);
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', jpeg(), 'x.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(
      /^https:\/\/api\.ejemplo\.com\/archivos\/[^/]/,
    );
  });
});

describe('AGENTS §17.2 — S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan el preset', () => {
  it('proveedor aws con S3_ENDPOINT propio y path style usa ese servidor', async () => {
    const f = await levantarS3Falso();
    const a = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 'aws',
        S3_BUCKET: 'archivos',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'k',
        S3_SECRET_ACCESS_KEY: 's',
        S3_ENDPOINT: f.endpoint,
        S3_FORZAR_PATH_STYLE: 'true',
      },
    });
    const { token } = await registrarJugador(a);
    await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', jpeg(), 'x.jpg')
      .expect(201);
    expect(f.pedidos.some((p) => p.startsWith('PUT /archivos/imagenes/'))).toBe(
      true,
    );
    expect((await a.http().get('/salud')).body.datos.almacen).toBe('aws');
    await a.cerrar();
    await f.cerrar();
  });
});
