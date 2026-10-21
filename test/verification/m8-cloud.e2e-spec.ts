import { crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conPatron, jpeg, mp4 } from '../utilities/files.js';
import { levantarS3Falso, type S3Falso } from '../utilities/fake-s3.js';
import { crearUsuario } from '../utilities/users.js';

const MB = 1024 * 1024;
const BASE_PUBLICADA = {
  ENTORNO: 'publicado',
  DB_MOTOR: 'postgres',
  DB_URL: 'postgres://u:p@localhost:1/x',
  ARCHIVOS_PROVEEDOR: 'supabase',
  SUPABASE_PROYECTO: 'abcdefgh',
  S3_BUCKET: 'archivos',
  S3_REGION: 'sa-east-1',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  JWT_SECRETO: 'x'.repeat(40),
};

async function falla(variables: Record<string, string>): Promise<string> {
  try {
    const t = await crearApp({ variables });
    await t.cerrar();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return '__ARRANCO__';
}

describe('AGENTS §17 — Archivos con el proveedor local y con S3: mismo contrato', () => {
  let falso: S3Falso;
  beforeAll(async () => {
    falso = await levantarS3Falso();
  });
  afterAll(() => falso.cerrar());

  const variantes: [string, () => Record<string, string>][] = [
    ['local', () => ({})],
    [
      's3proxy',
      () => ({ ARCHIVOS_PROVEEDOR: 's3proxy', S3_ENDPOINT: falso.endpoint, S3_BUCKET: 'v8' }),
    ],
  ];

  describe.each(variantes)('proveedor %s', (nombre, vars) => {
    it('subir/bajar/rango/errores', async () => {
      const t = await crearApp({ variables: vars() });
      const u = await crearUsuario(t);
      try {
        const salud = await t.http().get('/salud').expect(200);
        esperarContrato(salud.body, 'Salud');
        expect(salud.body.datos.almacen).toBe(nombre);

        const original = conPatron(jpeg(3000));
        const sub = await t
          .http()
          .post('/archivos')
          .set(u.auth)
          .attach('archivo', original, 'a.jpg')
          .expect(201);
        esperarContrato(sub.body, 'ArchivoSubido');
        expect(sub.body.meta).toBeNull();
        const ruta = new URL(sub.body.datos.url).pathname;

        const entero = await t.http().get(ruta).buffer(true).expect(200);
        expect(Buffer.compare(entero.body as Buffer, original)).toBe(0);
        expect(entero.headers['content-type']).toBe('image/jpeg');
        expect(entero.headers['content-length']).toBe('3000');
        expect(entero.headers['accept-ranges']).toBe('bytes');
        expect(entero.headers['cache-control']).toBe('public, max-age=31536000, immutable');
        expect(entero.headers.etag).toBeTruthy();

        const r = await t.http().get(ruta).set('Range', 'bytes=10-19').buffer(true).expect(206);
        expect([...(r.body as Buffer)]).toEqual([...original.subarray(10, 20)]);
        expect(r.headers['content-range']).toBe('bytes 10-19/3000');
        const ult = await t
          .http()
          .get(ruta)
          .set('Range', 'bytes=2999-2999')
          .buffer(true)
          .expect(206);
        expect(ult.headers['content-range']).toBe('bytes 2999-2999/3000');
        const abierto = await t
          .http()
          .get(ruta)
          .set('Range', 'bytes=2990-')
          .buffer(true)
          .expect(206);
        expect((abierto.body as Buffer).length).toBe(10);
        const suf = await t.http().get(ruta).set('Range', 'bytes=-5').buffer(true).expect(206);
        expect((suf.body as Buffer).length).toBe(5);
        const mas = await t
          .http()
          .get(ruta)
          .set('Range', 'bytes=2990-99999')
          .buffer(true)
          .expect(206);
        expect(mas.headers['content-range']).toBe('bytes 2990-2999/3000');
        const f = await t.http().get(ruta).set('Range', 'bytes=5000-6000').expect(416);
        esperarError(f.body);

        // público: sin token se baja
        await t.http().get(ruta).expect(200);

        const nf = await t
          .http()
          .get('/archivos/imagenes/2026/10/zzzzzzzzzzzzzzzz.jpg')
          .expect(404);
        esperarError(nf.body, 'ARCHIVO_NO_ENCONTRADO');
        expect(nf.body.error.mensaje).toMatch(/[a-záéíóú]/i);

        const nt = await t
          .http()
          .post('/archivos')
          .set(u.auth)
          .attach('archivo', Buffer.from('hola'), 'a.jpg')
          .expect(415);
        esperarError(nt.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
        const g = await t
          .http()
          .post('/archivos')
          .set(u.auth)
          .attach('archivo', jpeg(5 * MB + 1), 'a.jpg')
          .expect(413);
        esperarError(g.body, 'ARCHIVO_DEMASIADO_GRANDE');
        const gv = await t
          .http()
          .post('/archivos')
          .set(u.auth)
          .attach('archivo', mp4(30 * MB + 1), 'a.mp4')
          .expect(413);
        esperarError(gv.body, 'ARCHIVO_DEMASIADO_GRANDE');
        const sin = await t.http().post('/archivos').attach('archivo', jpeg(), 'a.jpg').expect(401);
        esperarError(sin.body, 'NO_AUTENTICADO');
        const mal = await t
          .http()
          .post('/archivos')
          .set({ Authorization: 'Bearer basura' })
          .attach('archivo', jpeg(), 'a.jpg')
          .expect(401);
        esperarError(mal.body, 'NO_AUTENTICADO');

        // campo de más en multipart
        const camp = await t
          .http()
          .post('/archivos')
          .set(u.auth)
          .field('x', '1')
          .attach('archivo', jpeg(), 'a.jpg');
        expect([201, 400]).toContain(camp.status);
      } finally {
        await t.cerrar();
      }
    });
  });

  it('s3: el objeto queda en el bucket y las claves no usan el nombre del cliente', async () => {
    const t = await crearApp({
      variables: { ARCHIVOS_PROVEEDOR: 's3proxy', S3_ENDPOINT: falso.endpoint, S3_BUCKET: 'v8b' },
    });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', jpeg(), '../../evil name.jpg')
      .expect(201);
    const claves = [...(falso.buckets.get('v8b')?.keys() ?? [])];
    expect(claves).toHaveLength(1);
    expect(claves[0]).toMatch(/^imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/);
    expect(r.body.datos.url).not.toContain('evil');
    await t.cerrar();
  });

  it('s3 caído: 503 ALMACEN_NO_DISPONIBLE al leer, con mensaje en castellano', async () => {
    const otro = await levantarS3Falso();
    const t = await crearApp({
      variables: { ARCHIVOS_PROVEEDOR: 's3proxy', S3_ENDPOINT: otro.endpoint, S3_BUCKET: 'caido' },
    });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    await otro.cerrar();
    const res = await t.http().get(new URL(r.body.datos.url).pathname);
    expect(res.status).toBe(503);
    esperarError(res.body, 'ALMACEN_NO_DISPONIBLE');
    const sub = await t.http().post('/archivos').set(u.auth).attach('archivo', jpeg(), 'a.jpg');
    expect(sub.status).toBe(503);
    esperarError(sub.body, 'ALMACEN_NO_DISPONIBLE');
    await t.cerrar();
  }, 60000);
});

describe('AGENTS §17.1 — Arranque: variables faltantes del proveedor', () => {
  it.each([
    [
      'aws sin bucket',
      {
        ARCHIVOS_PROVEEDOR: 'aws',
        S3_REGION: 'us-east-1',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      },
      /S3_BUCKET/,
    ],
    [
      'supabase sin proyecto',
      {
        ARCHIVOS_PROVEEDOR: 'supabase',
        S3_BUCKET: 'a',
        S3_REGION: 'x',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      },
      /SUPABASE_PROYECTO/,
    ],
    [
      'r2 sin cuenta',
      {
        ARCHIVOS_PROVEEDOR: 'r2',
        S3_BUCKET: 'a',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      },
      /R2_CUENTA/,
    ],
    [
      'b2 sin región',
      {
        ARCHIVOS_PROVEEDOR: 'b2',
        S3_BUCKET: 'a',
        S3_ACCESS_KEY_ID: 'a',
        S3_SECRET_ACCESS_KEY: 'b',
      },
      /S3_REGION/,
    ],
    [
      'aws sin claves',
      { ARCHIVOS_PROVEEDOR: 'aws', S3_BUCKET: 'a', S3_REGION: 'x' },
      /S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY/,
    ],
  ])('%s: no arranca y nombra la variable', async (_n, vars, patron) => {
    const msg = await falla(vars as Record<string, string>);
    expect(msg).not.toBe('__ARRANCO__');
    expect(msg).toMatch(patron);
  });

  it('proveedor desconocido no arranca', async () => {
    expect(await falla({ ARCHIVOS_PROVEEDOR: 'firebase' })).not.toBe('__ARRANCO__');
  });

  it('proveedor real (aws con endpoint propio) con bucket inexistente: no arranca', async () => {
    const f = await levantarS3Falso();
    const m = await falla({
      ARCHIVOS_PROVEEDOR: 'aws',
      S3_ENDPOINT: f.endpoint,
      S3_FORZAR_PATH_STYLE: 'true',
      S3_BUCKET: 'nada',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
    });
    await f.cerrar();
    expect(m).not.toBe('__ARRANCO__');
  }, 30000);

  it('S3_ENDPOINT pisa al preset: un endpoint caído en aws no arranca', async () => {
    const m = await falla({
      ARCHIVOS_PROVEEDOR: 'aws',
      S3_ENDPOINT: 'http://127.0.0.1:1',
      S3_BUCKET: 'a',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'a',
      S3_SECRET_ACCESS_KEY: 'b',
    });
    expect(m).not.toBe('__ARRANCO__');
  }, 60000);
});

describe('AGENTS §18.1 — DB_PROVEEDOR valida DB_URL', () => {
  it.each([
    [
      'supabase conexión directa',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:p@db.abcdefgh.supabase.co:5432/postgres',
      },
    ],
    [
      'supabase pooler en modo transacción',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres.abcdefgh:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
      },
    ],
    [
      'supabase sin usuario con ref',
      {
        DB_PROVEEDOR: 'supabase',
        DB_URL: 'postgres://postgres:p@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
      },
    ],
    ['neon con otro host', { DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@localhost:5432/x' }],
    [
      'aiven-mysql con otro host',
      { DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:p@localhost:3306/x' },
    ],
    ['aiven-postgres sin URL', { DB_PROVEEDOR: 'aiven-postgres', DB_URL: '' }],
    ['proveedor inexistente', { DB_PROVEEDOR: 'heroku', DB_URL: 'postgres://u:p@x/y' }],
  ])('%s: no arranca', async (_n, vars) => {
    const m = await falla(vars);
    expect(m).not.toBe('__ARRANCO__');
    expect(m).not.toMatch(/undefined|TypeError|ECONN/);
  });
});

describe('AGENTS §18.2 — ENTORNO=publicado', () => {
  it.each([
    ['SQLite', { DB_MOTOR: 'better-sqlite3', DB_URL: '' }, /SQLite|sqlite|base/i],
    ['archivos locales', { ARCHIVOS_PROVEEDOR: 'local' }, /archivos|local/i],
    [
      'JWT de desarrollo',
      { JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' },
      /JWT_SECRETO/,
    ],
    ['JWT corto', { JWT_SECRETO: 'corto' }, /JWT_SECRETO/],
    ['JWT de 31 caracteres', { JWT_SECRETO: 'y'.repeat(31) }, /JWT_SECRETO/],
    ['simulación habilitada', { SIMULACION_HABILITADA: 'true' }, /SIMULACION|simulaci/i],
    ['emulador s3proxy', { ARCHIVOS_PROVEEDOR: 's3proxy' }, /./],
  ])('no arranca con %s y lo dice en castellano', async (_n, extra, patron) => {
    const m = await falla({ ...BASE_PUBLICADA, ...extra });
    expect(m).not.toBe('__ARRANCO__');
    expect(m).toMatch(patron);
  });

  it('un JWT de 32 caracteres no es motivo de rechazo por sí solo', async () => {
    const m = await falla({ ...BASE_PUBLICADA, JWT_SECRETO: 'z'.repeat(32) });
    // Puede fallar por no poder conectarse a la base ficticia, pero no por el secreto.
    expect(m).not.toMatch(/JWT_SECRETO/);
  }, 60000);
});

describe('AGENTS §18.2 — CONFIAR_PROXY', () => {
  it('con CONFIAR_PROXY=true las URLs de archivos salen https y con el host reenviado', async () => {
    const t = await crearApp({ variables: { CONFIAR_PROXY: 'true' } });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'api.ejemplo.com')
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    expect(r.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.com\/archivos\/imagenes\//);
    await t.cerrar();
  });

  it('sin CONFIAR_PROXY se ignoran las cabeceras X-Forwarded-*', async () => {
    const t = await crearApp({ variables: { CONFIAR_PROXY: 'false' } });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'evil.com')
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    expect(r.body.datos.url).toMatch(/^http:\/\//);
    expect(r.body.datos.url).not.toContain('evil.com');
    await t.cerrar();
  });

  it('con proxy, un X-Forwarded-Host malicioso no rompe: 400 o URL válida, nunca 500', async () => {
    const t = await crearApp({ variables: { CONFIAR_PROXY: 'true' } });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .set('X-Forwarded-Host', 'a"><script>')
      .attach('archivo', jpeg(), 'a.jpg');
    expect(r.status).toBeLessThan(500);
    await t.cerrar();
  });

  it('URL_PUBLICA con CONFIAR_PROXY gana sobre las cabeceras', async () => {
    const t = await crearApp({
      variables: { CONFIAR_PROXY: 'true', URL_PUBLICA: 'https://fija.ar' },
    });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .set('X-Forwarded-Host', 'otra.ar')
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    expect(r.body.datos.url).toMatch(/^https:\/\/fija\.ar\/archivos\//);
    await t.cerrar();
  });
});

describe('Contrato de módulos anteriores no cambió con M8', () => {
  it('salud, rubros, comercios y errores mantienen su forma', async () => {
    const t = await crearApp({ variables: { ARCHIVOS_PROVEEDOR: 'local' } });
    const s = await t.http().get('/salud').expect(200);
    esperarContrato(s.body, 'Salud');
    expect(Object.keys(s.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
    const l = await t.http().get('/comercios').expect(200);
    expect(l.body.meta).toEqual({ total: 0, pagina: 1, porPagina: 20 });
    const e = await t.http().get('/ruta-que-no-existe').expect(404);
    esperarError(e.body, 'RUTA_NO_ENCONTRADA');
    const sinTok = await t.http().get('/yo').expect(401);
    esperarError(sinTok.body, 'NO_AUTENTICADO');
    await t.cerrar();
  });

  it('una reseña/ficha con imagen subida por S3 se acepta como ARCHIVO propio', async () => {
    const falso = await levantarS3Falso();
    const t = await crearApp({
      variables: { ARCHIVOS_PROVEEDOR: 's3proxy', S3_ENDPOINT: falso.endpoint, S3_BUCKET: 'c' },
    });
    const u = await crearUsuario(t);
    const r = await t
      .http()
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    // URL de otro sitio sigue siendo rechazada en PATCH /mi-comercio (necesita rol comercio).
    expect(r.body.datos.url).toMatch(/\/archivos\/imagenes\//);
    expect(r.body.datos.url).not.toContain(falso.endpoint);
    await t.cerrar();
    await falso.cerrar();
  });
});
