import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, MUESTRAS, registrarTurista, subirArchivo } from '../utilities/builders.js';

describe('AGENTS §8 — POST /archivos', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp({ ahora: '2026-11-14T12:00:00-03:00' });
    ({ token } = await registrarTurista(ctx));
  });
  afterAll(() => ctx.cerrar());

  const subir = (contenido: Buffer, nombre: string) =>
    ctx.http().post('/archivos').set(conSesion(token)).attach('archivo', contenido, nombre);

  it.each([
    ['png', MUESTRAS.png(), 'imagen', /\/archivos\/imagenes\/2026\/11\/[a-z0-9]{12}\.png$/],
    ['jpg', MUESTRAS.jpg(), 'imagen', /\/archivos\/imagenes\/2026\/11\/[a-z0-9]{12}\.jpg$/],
    ['m4a', MUESTRAS.m4a(), 'audio', /\/archivos\/audios\/2026\/11\/[a-z0-9]{12}\.m4a$/],
    ['mp4', MUESTRAS.mp4(), 'video', /\/archivos\/videos\/2026\/11\/[a-z0-9]{12}\.mp4$/],
  ])(
    'sube %s: 201 { url, tipo, bytes } con clave generada por el servidor',
    async (_n, contenido, tipo, forma) => {
      const res = await subir(contenido, 'mi foto de las termas.bin').expect(201);
      esperarContrato(res.body, 'ArchivoSubido');
      expect(res.body.datos).toEqual({ url: expect.stringMatching(forma), tipo, bytes: contenido.length });
      expect(res.body.datos.url).not.toContain('termas');
    },
  );

  it('la URL es absoluta con el Host del pedido', async () => {
    const res = await subir(MUESTRAS.png(), 'a.png').set('Host', '10.0.0.5:3000').expect(201);
    expect(res.body.datos.url).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\//);
  });

  it('TIPO_DE_ARCHIVO_NO_PERMITIDO: se mira la firma, no la extensión', async () => {
    esperarError(await subir(MUESTRAS.texto(), 'foto.jpg'), 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
  });

  it('ARCHIVO_DEMASIADO_GRANDE: una imagen de más de 5 MB', async () => {
    esperarError(
      await subir(MUESTRAS.png(5 * 1024 * 1024 + 1), 'grande.png'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('un audio de 6 MB entra (el límite de audio es 10 MB)', async () => {
    await subir(MUESTRAS.m4a(6 * 1024 * 1024), 'audio.m4a').expect(201);
  });

  it('ARCHIVO_DEMASIADO_GRANDE: más de 30 MB', async () => {
    esperarError(
      await subir(MUESTRAS.mp4(30 * 1024 * 1024 + 1), 'video.mp4'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('VALIDACION_FALLIDA sin archivo', async () => {
    const res = await ctx.http().post('/archivos').set(conSesion(token)).field('otro', 'x');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('VALIDACION_FALLIDA con el archivo en otro campo', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set(conSesion(token))
      .attach('foto', MUESTRAS.png(), 'a.png');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('NO_AUTENTICADO sin token', async () => {
    esperarError(
      await ctx.http().post('/archivos').attach('archivo', MUESTRAS.png(), 'a.png'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §8, §17.1 y R19 — GET /archivos/<clave> con Range', () => {
  let ctx: AppDePrueba;
  let url: string;
  const contenido = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
  contenido.set([0, 0, 0, 0x20, ...Buffer.from('ftypM4A ', 'latin1')], 0);

  beforeAll(async () => {
    ctx = await crearApp();
    const { token } = await registrarTurista(ctx);
    url = await subirArchivo(ctx, token, contenido, 'audioguia.m4a');
  });
  afterAll(() => ctx.cerrar());

  const ruta = () => new URL(url).pathname;

  it('es público y devuelve los mismos bytes, con cabeceras de caché', async () => {
    const res = await ctx.http().get(ruta()).responseType('blob').expect(200);
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
    expect(res.headers['content-type']).toBe('audio/mp4');
    expect(res.headers['content-length']).toBe('1000');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers.etag).toEqual(expect.any(String));
  });

  it('R19 — Range: bytes=10-19 → 206 con esos 10 bytes', async () => {
    const res = await ctx.http().get(ruta()).set('Range', 'bytes=10-19').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 10-19/1000');
    expect(res.headers['content-length']).toBe('10');
    expect(Buffer.compare(res.body as Buffer, contenido.subarray(10, 20))).toBe(0);
  });

  it('R19 — el último byte', async () => {
    const res = await ctx.http().get(ruta()).set('Range', 'bytes=-1').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 999-999/1000');
    expect((res.body as Buffer)[0]).toBe(contenido[999]);
  });

  it('R19 — desde un byte hasta el final', async () => {
    const res = await ctx.http().get(ruta()).set('Range', 'bytes=990-').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 990-999/1000');
    expect((res.body as Buffer).length).toBe(10);
  });

  it('RANGO_NO_SATISFACIBLE fuera del archivo', async () => {
    const res = await ctx.http().get(ruta()).set('Range', 'bytes=5000-6000');
    esperarError(res, 416, 'RANGO_NO_SATISFACIBLE');
    expect(res.headers['content-range']).toBe('bytes */1000');
  });

  it('If-None-Match con el ETag → 304', async () => {
    const primera = await ctx.http().get(ruta());
    await ctx.http().get(ruta()).set('If-None-Match', primera.headers.etag).expect(304);
  });

  it.each([
    '/archivos/imagenes/2026/11/noexiste1234.jpg',
    '/archivos/../../etc/passwd',
    '/archivos/cualquier-cosa',
    '/archivos/imagenes/2026/11/%2e%2e%2fsecreto.jpg',
  ])('ARCHIVO_NO_ENCONTRADO: %s', async (camino) => {
    const res = await ctx.http().get(camino);
    expect([404]).toContain(res.status);
    expect(['ARCHIVO_NO_ENCONTRADO', 'RUTA_NO_ENCONTRADA']).toContain(res.body.error.codigo);
  });
});

describe('AGENTS §8 y §18.2 — Origen de las URLs', () => {
  it('URL_PUBLICA manda sobre el Host', async () => {
    const ctx = await crearApp({ entorno: { URL_PUBLICA: 'https://mi-api.ejemplo.com/' } });
    try {
      const { token } = await registrarTurista(ctx);
      const url = await subirArchivo(ctx, token);
      expect(url).toMatch(/^https:\/\/mi-api\.ejemplo\.com\/archivos\/imagenes\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('CONFIAR_PROXY=true: X-Forwarded-Proto y X-Forwarded-Host dan URLs https', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'mi-api.onrender.com')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      expect(res.body.datos.url).toMatch(/^https:\/\/mi-api\.onrender\.com\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin CONFIAR_PROXY, las cabeceras X-Forwarded-* se ignoran', async () => {
    const ctx = await crearApp();
    try {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('Host', '10.0.0.5:3000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'trucho.com')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      expect(res.body.datos.url).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });
});
