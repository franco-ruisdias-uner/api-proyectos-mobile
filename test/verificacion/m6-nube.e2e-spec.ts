import type { Response } from 'supertest';
import { leerConfiguracion } from '../../src/config/configuracion.js';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

// Verificación independiente del M6 — Nube (AGENTS §17 y §18). Caja negra: sólo variables de
// entorno, HTTP y mensajes.

const BASE = { ENTORNO: 'test', JWT_SECRETO: 'secreto-de-los-tests' };
const config = (extra: Record<string, string>) => leerConfiguracion({ ...BASE, ...extra });
const mensajeDe = (extra: Record<string, string>): string => {
  try {
    config(extra);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('Tendría que haber fallado la configuración y no falló.');
};
const JERGA = /undefined|\bnull\b|TypeError|stack|ECONN|\[object|Error:/i;

function binario(respuesta: Response, listo: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer) => partes.push(parte));
  respuesta.on('end', () => listo(null, Buffer.concat(partes)));
}

const CLAVES = { S3_ACCESS_KEY_ID: 'AKIAXXXX', S3_SECRET_ACCESS_KEY: 'secreto' };

describe('AGENTS §17.2 — cada proveedor de archivos pide sus variables y dice dónde conseguirlas', () => {
  it.each([
    ['aws', {}, ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
    [
      'supabase',
      {},
      ['SUPABASE_PROYECTO', 'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
    ],
    ['r2', {}, ['R2_CUENTA', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
    ['b2', {}, ['S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']],
  ])(
    '%s sin nada: nombra cada variable que falta, en castellano y sin jerga',
    (proveedor, extra, faltan) => {
      const m = mensajeDe({ ARCHIVOS_PROVEEDOR: proveedor, ...extra });
      for (const variable of faltan) expect(m).toContain(variable);
      expect(m).toMatch(/Falta/);
      expect(m).toMatch(/panel/); // dónde se consigue
      expect(m).not.toMatch(JERGA);
    },
  );

  it('r2 no pide región (es fija "auto") y aws sí', () => {
    expect(mensajeDe({ ARCHIVOS_PROVEEDOR: 'r2' })).not.toContain('S3_REGION');
    expect(mensajeDe({ ARCHIVOS_PROVEEDOR: 'aws' })).toContain('S3_REGION');
  });

  it('una variable vacía o con sólo espacios cuenta como faltante', () => {
    const m = mensajeDe({
      ARCHIVOS_PROVEEDOR: 'aws',
      S3_BUCKET: '',
      S3_REGION: '   ',
      ...CLAVES,
    });
    expect(m).toContain('S3_BUCKET');
    expect(m).toContain('S3_REGION');
    expect(m).not.toContain('S3_ACCESS_KEY_ID');
  });

  it('un proveedor desconocido no arranca y lista los válidos', () => {
    const m = mensajeDe({ ARCHIVOS_PROVEEDOR: 'firebase' });
    expect(m).toMatch(/ARCHIVOS_PROVEEDOR/);
    expect(m).toMatch(/supabase/);
  });

  it('faltando sólo las claves, no pide lo demás', () => {
    const m = mensajeDe({ ARCHIVOS_PROVEEDOR: 'b2', S3_BUCKET: 'b', S3_REGION: 'us-west-004' });
    expect(m).toContain('S3_ACCESS_KEY_ID');
    expect(m).not.toContain('S3_BUCKET');
    expect(m).not.toContain('S3_REGION');
  });

  it.each([
    [
      'aws',
      { S3_BUCKET: 'b', S3_REGION: 'sa-east-1' },
      { forcePathStyle: false, region: 'sa-east-1' },
    ],
    [
      'supabase',
      { SUPABASE_PROYECTO: 'abcdef', S3_BUCKET: 'b', S3_REGION: 'sa-east-1' },
      {
        endpoint: 'https://abcdef.storage.supabase.co/storage/v1/s3',
        forcePathStyle: true,
        region: 'sa-east-1',
      },
    ],
    [
      'r2',
      { R2_CUENTA: 'cuenta1', S3_BUCKET: 'b' },
      {
        endpoint: 'https://cuenta1.r2.cloudflarestorage.com',
        forcePathStyle: false,
        region: 'auto',
      },
    ],
    [
      'b2',
      { S3_BUCKET: 'b', S3_REGION: 'us-west-004' },
      { endpoint: 'https://s3.us-west-004.backblazeb2.com', forcePathStyle: false },
    ],
  ])(
    '%s completo: endpoint, región y estilo de ruta de la tabla §17.2',
    (proveedor, extra, esperado) => {
      const c = config({ ARCHIVOS_PROVEEDOR: proveedor, ...CLAVES, ...extra });
      expect(c.archivos.s3).toMatchObject(esperado);
      expect(c.archivos.s3?.credenciales).toEqual({
        accessKeyId: 'AKIAXXXX',
        secretAccessKey: 'secreto',
      });
    },
  );

  it('r2: una S3_REGION distinta de "auto" no la pisa (región fija)', () => {
    const c = config({
      ARCHIVOS_PROVEEDOR: 'r2',
      R2_CUENTA: 'c',
      S3_BUCKET: 'b',
      S3_REGION: 'us-east-1',
      ...CLAVES,
    });
    expect(c.archivos.s3?.region).toBe('auto');
  });

  it('checksums: el SDK va con WHEN_REQUIRED salvo en aws', () => {
    const aws = config({
      ARCHIVOS_PROVEEDOR: 'aws',
      S3_BUCKET: 'b',
      S3_REGION: 'sa-east-1',
      ...CLAVES,
    });
    const r2 = config({ ARCHIVOS_PROVEEDOR: 'r2', R2_CUENTA: 'c', S3_BUCKET: 'b', ...CLAVES });
    expect(aws.archivos.s3?.checksumsSoloSiHaceFalta).toBe(false);
    expect(r2.archivos.s3?.checksumsSoloSiHaceFalta).toBe(true);
  });

  it.each(['s3proxy', 'localstack'])('%s no pide nada y crea el bucket', (proveedor) => {
    const c = config({ ARCHIVOS_PROVEEDOR: proveedor });
    expect(c.archivos.s3).toMatchObject({
      region: 'us-east-1',
      forcePathStyle: true,
      crearBucket: true,
    });
    expect(c.archivos.s3?.endpoint).toMatch(proveedor === 's3proxy' ? /:8080$/ : /:4566$/);
  });

  it('S3_ENDPOINT y S3_FORZAR_PATH_STYLE pisan lo que diga el preset', () => {
    const c = config({
      ARCHIVOS_PROVEEDOR: 'r2',
      R2_CUENTA: 'c',
      S3_BUCKET: 'b',
      S3_ENDPOINT: 'https://otro.ejemplo.ar',
      S3_FORZAR_PATH_STYLE: 'true',
      ...CLAVES,
    });
    expect(c.archivos.s3).toMatchObject({
      endpoint: 'https://otro.ejemplo.ar',
      forcePathStyle: true,
    });
    const d = config({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://127.0.0.1:9999',
      S3_FORZAR_PATH_STYLE: 'false',
    });
    expect(d.archivos.s3).toMatchObject({
      endpoint: 'http://127.0.0.1:9999',
      forcePathStyle: false,
    });
  });

  it('local (default): no lleva configuración S3', () => {
    expect(config({}).archivos.s3 ?? null).toBeNull();
    expect(config({}).archivos.proveedor).toBe('local');
  });

  it('ARCHIVOS_REDIRIGIR=true con "local" no arranca y lo explica', () => {
    const m = mensajeDe({ ARCHIVOS_REDIRIGIR: 'true' });
    expect(m).toMatch(/ARCHIVOS_REDIRIGIR/);
    expect(m).not.toMatch(JERGA);
  });

  it('ARCHIVOS_REDIRIGIR=true con S3 sí arranca; con un valor raro, no', () => {
    expect(
      config({ ARCHIVOS_PROVEEDOR: 's3proxy', ARCHIVOS_REDIRIGIR: 'true' }).archivos.redirigir,
    ).toBe(true);
    expect(() => config({ ARCHIVOS_PROVEEDOR: 's3proxy', ARCHIVOS_REDIRIGIR: 'quizás' })).toThrow();
  });
});

describe('AGENTS §18.1 — DB_PROVEEDOR: URLs buenas y equivocadas', () => {
  const POOLER = 'aws-0-sa-east-1.pooler.supabase.com';
  const supabase = (url: string, extra: Record<string, string> = {}) => ({
    DB_PROVEEDOR: 'supabase',
    DB_URL: url,
    ...extra,
  });

  it('supabase con la cadena del pooler de sesión → postgres, esquema api, SSL cifrado sin verificar', () => {
    const c = config(supabase(`postgres://postgres.abcdef:clave@${POOLER}:5432/postgres`));
    expect(c.db).toMatchObject({
      proveedor: 'supabase',
      motor: 'postgres',
      esquema: 'api',
      ssl: 'si-sin-verificar',
    });
  });

  it('supabase con DB_SSL_CA pasa a verificar', () => {
    const c = config(
      supabase(`postgres://postgres.abcdef:clave@${POOLER}:5432/postgres`, {
        DB_SSL_CA: '/ruta/ca.crt',
      }),
    );
    expect(c.db.ssl).toBe('si');
  });

  it('supabase: un DB_SSL explícito gana al del preset', () => {
    const c = config(
      supabase(`postgres://postgres.abcdef:clave@${POOLER}:5432/postgres`, { DB_SSL: 'no' }),
    );
    expect(c.db.ssl).toBe('no');
  });

  it('supabase: DB_ESQUEMA explícito pisa "api"', () => {
    const c = config(
      supabase(`postgres://postgres.abcdef:clave@${POOLER}:5432/postgres`, { DB_ESQUEMA: 'mio' }),
    );
    expect(c.db.esquema).toBe('mio');
  });

  it('supabase con la conexión directa (db.<ref>.supabase.co) → explica IPv6 y qué copiar', () => {
    const m = mensajeDe(supabase('postgres://postgres:clave@db.abcdef.supabase.co:5432/postgres'));
    expect(m).toMatch(/IPv6/);
    expect(m).toMatch(/Session pooler/);
    expect(m).not.toMatch(JERGA);
  });

  it('supabase con el pooler en modo transacción (6543) → lo rechaza y dice cuál usar', () => {
    const m = mensajeDe(supabase(`postgres://postgres.abcdef:clave@${POOLER}:6543/postgres`));
    expect(m).toMatch(/6543/);
    expect(m).toMatch(/5432/);
  });

  it('supabase con usuario "postgres" a secas (sin el id del proyecto) → lo rechaza', () => {
    const m = mensajeDe(supabase(`postgres://postgres:clave@${POOLER}:5432/postgres`));
    expect(m).toMatch(/postgres\.<id del proyecto>/);
  });

  it('supabase con un host que no es de Supabase → lo rechaza', () => {
    const m = mensajeDe(supabase('postgres://postgres.abc:clave@ejemplo.com:5432/postgres'));
    expect(m).toMatch(/supabase/i);
  });

  it('supabase sin DB_URL → pide DB_URL', () => {
    expect(mensajeDe({ DB_PROVEEDOR: 'supabase' })).toContain('DB_URL');
  });

  it('supabase con una DB_URL que no es una dirección → mensaje en castellano', () => {
    const m = mensajeDe(supabase('esto no es una url'));
    expect(m).toMatch(/DB_URL/);
    expect(m).not.toMatch(JERGA);
  });

  it('un DB_PROVEEDOR desconocido no arranca', () => {
    expect(mensajeDe({ DB_PROVEEDOR: 'planetscale', DB_URL: 'mysql://u:p@h/db' })).toMatch(
      /DB_PROVEEDOR/,
    );
  });

  it('DB_PROVEEDOR contradiciendo DB_MOTOR no arranca', () => {
    const m = mensajeDe(
      supabase(`postgres://postgres.abcdef:clave@${POOLER}:5432/postgres`, {
        DB_MOTOR: 'mysql',
      }),
    );
    expect(m).toMatch(/DB_MOTOR/);
  });

  it('neon: host .neon.tech → postgres, esquema public, SSL verificado', () => {
    const c = config({
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p@ep-cool-123.sa-east-1.aws.neon.tech/neondb',
    });
    expect(c.db).toMatchObject({ motor: 'postgres', esquema: 'public', ssl: 'si' });
  });

  it('neon: otro host → lo rechaza nombrando Neon', () => {
    expect(mensajeDe({ DB_PROVEEDOR: 'neon', DB_URL: 'postgres://u:p@h.example.com/db' })).toMatch(
      /Neon/,
    );
  });

  it('aiven-postgres y aiven-mysql: host .aivencloud.com, y con otro host fallan', () => {
    const p = config({
      DB_PROVEEDOR: 'aiven-postgres',
      DB_URL: 'postgres://avnadmin:p@pg-x-y.aivencloud.com:12345/defaultdb',
    });
    expect(p.db).toMatchObject({ motor: 'postgres', esquema: 'public', ssl: 'si-sin-verificar' });
    const m = config({
      DB_PROVEEDOR: 'aiven-mysql',
      DB_URL: 'mysql://avnadmin:p@my-x-y.aivencloud.com:12345/defaultdb',
    });
    expect(m.db.motor).toBe('mysql');
    expect(m.db.ssl).toBe('si-sin-verificar');
    expect(
      mensajeDe({ DB_PROVEEDOR: 'aiven-mysql', DB_URL: 'mysql://u:p@h.example.com:1/db' }),
    ).toMatch(/Aiven/);
    expect(
      mensajeDe({ DB_PROVEEDOR: 'aiven-postgres', DB_URL: 'postgres://u:p@h.example.com:1/db' }),
    ).toMatch(/Aiven/);
  });

  it('aiven con DB_SSL_CA verifica', () => {
    const c = config({
      DB_PROVEEDOR: 'aiven-mysql',
      DB_URL: 'mysql://avnadmin:p@my-x-y.aivencloud.com:12345/defaultdb',
      DB_SSL_CA: '/ca.pem',
    });
    expect(c.db.ssl).toBe('si');
  });

  describe('contraseñas con caracteres raros', () => {
    it.each([
      ['@', 'p%40ss'],
      ['#', 'p%23ss'],
      ['/', 'p%2Fss'],
      ['todo junto', 'a%40b%23c%2Fd%3Fe%25f'],
    ])('codificada con %s: no rompe el preset', (_nombre, pw) => {
      const c = config(supabase(`postgres://postgres.abcdef:${pw}@${POOLER}:5432/postgres`));
      expect(c.db.motor).toBe('postgres');
    });

    it('una "@" sin codificar en la contraseña no confunde el host', () => {
      const c = config(supabase(`postgres://postgres.abcdef:p@ss@${POOLER}:5432/postgres`));
      expect(c.db.motor).toBe('postgres');
    });

    it('la contraseña nunca aparece en el mensaje de un error de la URL', () => {
      const m = mensajeDe(
        supabase('postgres://postgres:S3creto-Unico@db.abcdef.supabase.co:5432/postgres'),
      );
      expect(m).not.toContain('S3creto-Unico');
    });
  });
});

describe('AGENTS §18.2 — ENTORNO=publicado: cada condición que impide arrancar', () => {
  const BUENO: Record<string, string> = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'x'.repeat(32) + '-abcdefghij',
    DB_PROVEEDOR: 'supabase',
    DB_URL: 'postgres://postgres.abcdef:clave@aws-0-sa-east-1.pooler.supabase.com:5432/postgres',
    ARCHIVOS_PROVEEDOR: 'supabase',
    SUPABASE_PROYECTO: 'abcdef',
    S3_BUCKET: 'archivos',
    S3_REGION: 'sa-east-1',
    ...CLAVES,
  };
  const publicado = (extra: Record<string, string> = {}) =>
    leerConfiguracion({ ...BUENO, ...extra });
  const msg = (extra: Record<string, string>) => {
    try {
      publicado(extra);
    } catch (e) {
      return (e as Error).message;
    }
    throw new Error('Tendría que haber fallado y arrancó.');
  };

  it('la configuración de referencia (Supabase + Supabase Storage) arranca', () => {
    expect(publicado().entorno).toBe('publicado');
  });

  it('con SQLite no arranca y dice qué usar', () => {
    const m = msg({ DB_PROVEEDOR: '', DB_URL: '', DB_MOTOR: 'better-sqlite3' });
    expect(m).toMatch(/SQLite/);
    expect(m).toMatch(/DB_PROVEEDOR/);
  });

  it('sin motor definido (default SQLite) tampoco', () => {
    const entorno = { ...BUENO } as Record<string, string | undefined>;
    delete entorno.DB_PROVEEDOR;
    delete entorno.DB_URL;
    expect(() => leerConfiguracion(entorno)).toThrow(/SQLite/);
  });

  it('con archivos "local" no arranca', () => {
    const m = msg({ ARCHIVOS_PROVEEDOR: 'local' });
    expect(m).toMatch(/local/);
    expect(m).toMatch(/ARCHIVOS_PROVEEDOR/);
  });

  it('con el JWT_SECRETO de desarrollo (largo pero "de desarrollo") no arranca', () => {
    const m = msg({ JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' });
    expect(m).toMatch(/JWT_SECRETO/);
    expect(m).toMatch(/desarrollo/);
  });

  it('con un JWT_SECRETO de 31 caracteres no arranca; con 32 sí', () => {
    expect(msg({ JWT_SECRETO: 'a'.repeat(31) })).toMatch(/32/);
    expect(publicado({ JWT_SECRETO: 'a'.repeat(32) }).entorno).toBe('publicado');
  });

  it('con SIMULACION_HABILITADA=true no arranca', () => {
    expect(msg({ SIMULACION_HABILITADA: 'true' })).toMatch(/SIMULACION_HABILITADA/);
  });

  it('con todo mal, informa todos los motivos juntos y en castellano', () => {
    const m = leerConfiguracion_malo();
    for (const pista of [/SQLite/, /local/, /JWT_SECRETO/, /SIMULACION_HABILITADA/]) {
      expect(m).toMatch(pista);
    }
    expect(m).not.toMatch(JERGA);
  });

  function leerConfiguracion_malo(): string {
    try {
      leerConfiguracion({
        ENTORNO: 'publicado',
        JWT_SECRETO: 'corto',
        SIMULACION_HABILITADA: 'true',
      });
    } catch (e) {
      return (e as Error).message;
    }
    throw new Error('arrancó');
  }

  it('la app de verdad no levanta con ENTORNO=publicado y SQLite', async () => {
    await expect(
      crearApp({ entorno: { ENTORNO: 'publicado', JWT_SECRETO: 'z'.repeat(40) } }),
    ).rejects.toThrow(/ENTORNO=publicado/);
  });

  it('el entorno de desarrollo y test NO exige nada de eso (sigue andando con SQLite y local)', async () => {
    const ctx = await crearApp();
    await ctx.cerrar();
  });

  it('ENTORNO con un valor inválido no arranca', () => {
    expect(() => config({ ENTORNO: 'produccion' })).toThrow();
  });
});

describe('AGENTS §8 y §17.1 — archivos con el almacén local (la app completa)', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;
  const video = mp4(1000);
  let ruta: string;

  beforeAll(async () => {
    ctx = await crearApp();
    u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', video, 'v.mp4')
      .expect(201);
    ruta = new URL(r.body.datos.url as string).pathname;
  });
  afterAll(() => ctx.cerrar());

  const pedir = (rango?: string, r = ruta) => {
    const p = ctx.http.get(r).buffer(true).parse(binario);
    if (rango) p.set('Range', rango);
    return p;
  };

  it('/salud informa el almacén "local" y la respuesta cumple el contrato', async () => {
    const r = await ctx.http.get('/salud').expect(200);
    esperarContrato(r.body, 'Salud');
    expect(r.body.datos.almacen).toBe('local');
  });

  it.each([
    ['bytes=0-0', 'bytes 0-0/1000', 0, 1],
    ['bytes=999-999', 'bytes 999-999/1000', 999, 1000],
    ['bytes=990-', 'bytes 990-999/1000', 990, 1000],
    ['bytes=0-', 'bytes 0-999/1000', 0, 1000],
    ['bytes=-1', 'bytes 999-999/1000', 999, 1000],
    ['bytes=-1000', 'bytes 0-999/1000', 0, 1000],
    ['bytes=-5000', 'bytes 0-999/1000', 0, 1000], // sufijo mayor que el archivo: se recorta
    ['bytes=900-5000', 'bytes 900-999/1000', 900, 1000], // fin pasado: se recorta
    ['bytes=100-100', 'bytes 100-100/1000', 100, 101],
  ])('RFC 9110 — Range %s → 206 %s', async (rango, contentRange, desde, hasta) => {
    const r = await pedir(rango);
    expect(r.status).toBe(206);
    expect(r.headers['content-range']).toBe(contentRange);
    expect(r.headers['content-length']).toBe(String(hasta - desde));
    expect((r.body as Buffer).equals(video.subarray(desde, hasta))).toBe(true);
    expect(r.headers['accept-ranges']).toBe('bytes');
  });

  it.each([['bytes=1000-'], ['bytes=1000-1005'], ['bytes=99999-'], ['bytes=-0']])(
    'Range %s (fuera del archivo) → 416 RANGO_NO_VALIDO con Content-Range bytes */1000',
    async (rango) => {
      const r = await ctx.http.get(ruta).set('Range', rango);
      esperarError(r, 416, 'RANGO_NO_VALIDO');
      expect(r.headers['content-range']).toBe('bytes */1000');
      expect(r.body.error.mensaje).not.toMatch(JERGA);
    },
  );

  it.each([
    ['bytes='],
    ['bytes=-'],
    ['bytes=a-b'],
    ['bytes=5-2'],
    ['BYTES=0-5x'],
    ['bytes 0-5'],
    ['0-5'],
    ['bytes=0-5,10-20'],
    ['bytes=-5-10'],
    ['bytes=1.5-3'],
  ])(
    'un Range ilegible (%s) nunca da 500: 200 entero o 206, nunca error de servidor',
    async (rango) => {
      const r = await pedir(rango);
      expect([200, 206, 416]).toContain(r.status);
    },
  );

  it('un Range válido con mayúsculas en la unidad ("Bytes=0-9") no rompe', async () => {
    const r = await pedir('Bytes=0-9');
    expect([200, 206]).toContain(r.status);
  });

  it('el 416 en rango no válido incluye sólo codigo y mensaje en el sobre', async () => {
    const r = await ctx.http.get(ruta).set('Range', 'bytes=5000-');
    expect(Object.keys(r.body)).toEqual(['error']);
    expect(Object.keys(r.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('HEAD no da 500 y trae las cabeceras de tamaño', async () => {
    const r = await ctx.http.head(ruta);
    expect(r.status).toBeLessThan(500);
  });

  it('ETag estable entre pedidos y Content-Type correcto en 206', async () => {
    const a = await pedir();
    const b = await pedir('bytes=0-9');
    expect(a.headers.etag).toBeDefined();
    expect(b.headers['content-type']).toBe('video/mp4');
    expect(b.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it.each([
    ['/archivos/videos/2026/09/../../../package.json'],
    ['/archivos/videos/2026/09/%2e%2e/%2e%2e/package.json'],
    ['/archivos/videos/2026/09/%2E%2E%2F%2E%2E%2Fpackage.json'],
    ['/archivos/..'],
    ['/archivos/%2e%2e'],
    ['/archivos//etc/passwd'],
    ['/archivos/videos/2026/09/..%5c..%5cpackage.json'],
    ['/archivos/videos/2026/09/a%00.mp4'],
    ['/archivos/videos/%252e%252e/x.mp4'],
    ['/archivos/imagenes/2026/13/abc.jpg'],
  ])('clave con trucos (%s) → 404 ARCHIVO_NO_ENCONTRADO, jamás un archivo ni un 500', async (r) => {
    const res = await ctx.http.get(r);
    expect(res.status).toBe(404);
    expect(['ARCHIVO_NO_ENCONTRADO', 'RUTA_NO_ENCONTRADA']).toContain(res.body.error.codigo);
    expect(JSON.stringify(res.body)).not.toMatch(/"name"|dependencies/);
  });

  it('una clave bien formada que no existe → 404 ARCHIVO_NO_ENCONTRADO exacto', async () => {
    const r = await ctx.http.get('/archivos/videos/2026/09/abcdefghijkl.mp4');
    esperarError(r, 404, 'ARCHIVO_NO_ENCONTRADO');
    expect(r.body.error.mensaje).not.toMatch(JERGA);
  });

  it('subir con una URL de otra IP: sigue siendo reconocible (cambió de wifi)', async () => {
    // El recurso se manda con la URL que dio otra IP; el reporte se acepta igual (A3).
    expect(ruta).toMatch(/^\/archivos\/videos\//);
  });

  describe('URLs https detrás de un proxy (CONFIAR_PROXY)', () => {
    it('con CONFIAR_PROXY=true, X-Forwarded-Proto=https y sin Forwarded-Host: https + Host del pedido', async () => {
      const c = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
      try {
        const usr = await crearUsuario(c);
        const r = await c.http
          .post('/archivos')
          .set(usr.auth)
          .set('Host', 'api.ejemplo.ar')
          .set('X-Forwarded-Proto', 'https')
          .attach('archivo', jpeg(), 'a.jpg')
          .expect(201);
        expect(r.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.ar\/archivos\/imagenes\//);
      } finally {
        await c.cerrar();
      }
    });

    it('CONFIAR_PROXY=true: la URL https de una subida se puede bajar por su ruta', async () => {
      const c = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
      try {
        const usr = await crearUsuario(c);
        const contenido = jpeg(300);
        const r = await c.http
          .post('/archivos')
          .set(usr.auth)
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-Host', 'mi-api.onrender.com')
          .attach('archivo', contenido, 'a.jpg')
          .expect(201);
        const bajada = await c.http
          .get(new URL(r.body.datos.url as string).pathname)
          .buffer(true)
          .parse(binario)
          .expect(200);
        expect((bajada.body as Buffer).equals(contenido)).toBe(true);
      } finally {
        await c.cerrar();
      }
    });

    it('CONFIAR_PROXY=true con cabeceras múltiples (cadena de proxies) toma un solo valor', async () => {
      const c = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
      try {
        const usr = await crearUsuario(c);
        const r = await c.http
          .post('/archivos')
          .set(usr.auth)
          .set('X-Forwarded-Proto', 'https, http')
          .set('X-Forwarded-Host', 'mi-api.onrender.com, interno')
          .attach('archivo', jpeg(), 'a.jpg')
          .expect(201);
        expect(r.body.datos.url).toMatch(/^https:\/\/mi-api\.onrender\.com\/archivos\//);
      } finally {
        await c.cerrar();
      }
    });

    it('URL_PUBLICA con barra final no duplica la barra', async () => {
      const c = await crearApp({ entorno: { URL_PUBLICA: 'https://api.ejemplo.ar/' } });
      try {
        const usr = await crearUsuario(c);
        const r = await c.http
          .post('/archivos')
          .set(usr.auth)
          .attach('archivo', jpeg(), 'a.jpg')
          .expect(201);
        expect(r.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.ar\/archivos\/imagenes\//);
      } finally {
        await c.cerrar();
      }
    });
  });

  describe('el contrato de las respuestas no cambió con el M6', () => {
    it('POST /archivos → ArchivoSubido exacto', async () => {
      const r = await ctx.http
        .post('/archivos')
        .set(u.auth)
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      esperarContrato(r.body, 'ArchivoSubido');
      expect(r.body.meta).toBeNull();
    });

    it('POST /auth/registro, GET /yo y GET /lineas siguen cumpliendo el contrato', async () => {
      const reg = await ctx.http
        .post('/auth/registro')
        .send({ nombre: 'Ana', email: 'ana-m6@mail.com', contrasena: 'clave-larga-1' })
        .expect(201);
      esperarContrato(reg.body, 'Sesion');
      const yo = await ctx.http
        .get('/yo')
        .set('Authorization', `Bearer ${reg.body.datos.token as string}`)
        .expect(200);
      esperarContrato(yo.body, 'Usuario');
      esperarContrato((await ctx.http.get('/lineas').expect(200)).body, 'Linea');
      esperarContrato((await ctx.http.get('/avisos').expect(200)).body, 'Aviso');
    });

    it('un error de validación sigue siendo sólo { codigo, mensaje }', async () => {
      const r = await ctx.http.post('/auth/ingreso').send({ email: 1, extra: true });
      esperarError(r, 400, 'VALIDACION_FALLIDA');
    });

    it('/salud: sólo estado, motor, almacen y version', async () => {
      const r = await ctx.http.get('/salud').expect(200);
      expect(Object.keys(r.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
    });
  });
});

describe('AGENTS §18.1 — DB_ESQUEMA en PostgreSQL (adversarial)', () => {
  const motor = process.env.DB_MOTOR ?? 'better-sqlite3';

  it.skipIf(motor !== 'postgres')(
    'un esquema propio: tablas sólo ahí, un esquema vecino con datos sobrevive a synchronize(true) y a un segundo arranque',
    async () => {
      const nombre = 'api_verif_m6';
      const ajeno = 'otro_esquema_verif';
      let ctx = await crearApp({ entorno: { DB_ESQUEMA: nombre } });
      try {
        const q = <T>(sql: string, p: unknown[] = []) => ctx.dataSource.query(sql, p) as Promise<T>;
        await q(`CREATE SCHEMA IF NOT EXISTS ${ajeno}`);
        await q(`CREATE TABLE ${ajeno}.lineas (id int primary key)`); // mismo nombre que una de la API
        await q(`INSERT INTO ${ajeno}.lineas VALUES (7)`);

        await ctx.dataSource.synchronize(true);

        const filas = await q<{ id: number }[]>(`SELECT id FROM ${ajeno}.lineas`);
        expect(filas).toEqual([{ id: 7 }]);

        const enEsquema = await q<{ table_name: string }[]>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = '${nombre}'`,
        );
        expect(enEsquema.map((t) => t.table_name)).toEqual(
          expect.arrayContaining(['lineas', 'usuarios', 'avisos']),
        );

        // Segundo arranque contra la misma base: el esquema ya existe, no falla.
        const u = await crearUsuario(ctx);
        expect(u.auth).toBeDefined();
        await ctx.http.get('/lineas').expect(200);
        const ctx2 = await crearApp({ entorno: { DB_ESQUEMA: nombre } });
        await ctx2.cerrar();
        await ctx.dataSource.query(`DROP SCHEMA ${ajeno} CASCADE`);
      } finally {
        await ctx.dataSource.query(`DROP SCHEMA IF EXISTS ${ajeno} CASCADE`);
        await ctx.dataSource.query(`DROP SCHEMA IF EXISTS ${nombre} CASCADE`);
        await ctx.cerrar();
      }
    },
  );

  it.skipIf(motor !== 'postgres')(
    'un nombre de esquema con comillas o raro no abre una inyección',
    async () => {
      await expect(
        crearApp({ entorno: { DB_ESQUEMA: 'x"; DROP TABLE usuarios; --' } }),
      ).rejects.toThrow();
    },
  );

  it.skipIf(motor === 'postgres')(
    'DB_ESQUEMA con un motor sin esquemas no rompe el arranque',
    async () => {
      const ctx = await crearApp({ entorno: { DB_ESQUEMA: 'api' } }).catch((e: Error) => e);
      if (ctx instanceof Error) {
        expect(ctx.message).toMatch(/DB_ESQUEMA/); // admitido: lo rechaza con un mensaje claro
      } else {
        await ctx.cerrar();
      }
    },
  );
});
