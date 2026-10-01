import type { Response } from 'supertest';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { bucketNuevo, entornoS3DePrueba } from '../utilidades/s3.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

// Verificación independiente del M6 — archivos sobre S3 (S3Proxy), AGENTS §17.

function binario(respuesta: Response, listo: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer) => partes.push(parte));
  respuesta.on('end', () => listo(null, Buffer.concat(partes)));
}

describe('AGENTS §17.1 — Range, claves hostiles y errores con el adaptador S3', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;
  const video = mp4(4000);
  let ruta: string;

  beforeAll(async () => {
    ctx = await crearApp({ entorno: entornoS3DePrueba() });
    u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', video, 'v.mp4')
      .expect(201);
    esperarContrato(r.body, 'ArchivoSubido');
    ruta = new URL(r.body.datos.url as string).pathname;
  });
  afterAll(() => ctx.cerrar());

  const pedir = (rango?: string) => {
    const p = ctx.http.get(ruta).buffer(true).parse(binario);
    if (rango) p.set('Range', rango);
    return p;
  };

  it('/salud informa s3proxy y cumple el contrato', async () => {
    const r = await ctx.http.get('/salud').expect(200);
    esperarContrato(r.body, 'Salud');
    expect(r.body.datos.almacen).toBe('s3proxy');
  });

  it('entero: 200, mismos bytes, cabeceras de la sección 17.1', async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect((r.body as Buffer).equals(video)).toBe(true);
    expect(r.headers['content-length']).toBe('4000');
    expect(r.headers['content-type']).toBe('video/mp4');
    expect(r.headers['accept-ranges']).toBe('bytes');
    expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(r.headers.etag).toBeDefined();
  });

  it.each([
    ['bytes=0-0', 'bytes 0-0/4000', 0, 1],
    ['bytes=3999-3999', 'bytes 3999-3999/4000', 3999, 4000],
    ['bytes=3990-', 'bytes 3990-3999/4000', 3990, 4000],
    ['bytes=0-', 'bytes 0-3999/4000', 0, 4000],
    ['bytes=-1', 'bytes 3999-3999/4000', 3999, 4000],
    ['bytes=-100', 'bytes 3900-3999/4000', 3900, 4000],
    ['bytes=-99999', 'bytes 0-3999/4000', 0, 4000],
    ['bytes=3000-99999', 'bytes 3000-3999/4000', 3000, 4000],
  ])('Range %s → 206 %s con los bytes justos', async (rango, contentRange, desde, hasta) => {
    const r = await pedir(rango);
    expect(r.status).toBe(206);
    expect(r.headers['content-range']).toBe(contentRange);
    expect(r.headers['content-length']).toBe(String(hasta - desde));
    expect((r.body as Buffer).equals(video.subarray(desde, hasta))).toBe(true);
  });

  it.each([['bytes=4000-'], ['bytes=4000-4100'], ['bytes=100000-']])(
    'Range %s fuera del archivo → 416 RANGO_NO_VALIDO y Content-Range bytes */4000',
    async (rango) => {
      const r = await ctx.http.get(ruta).set('Range', rango);
      esperarError(r, 416, 'RANGO_NO_VALIDO');
      expect(r.headers['content-range']).toBe('bytes */4000');
    },
  );

  it.each([['bytes=a-b'], ['bytes=9-3'], ['items=0-9'], ['bytes=0-1,5-6'], ['bytes=']])(
    'Range ilegible (%s) → nunca 5xx',
    async (rango) => {
      const r = await pedir(rango);
      expect([200, 206, 416]).toContain(r.status);
    },
  );

  it('clave inexistente → 404 ARCHIVO_NO_ENCONTRADO', async () => {
    esperarError(
      await ctx.http.get('/archivos/videos/2026/09/abcdefghijkl.mp4'),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
  });

  it.each([
    ['/archivos/videos/2026/09/../../../x'],
    ['/archivos/videos/2026/09/%2e%2e/%2e%2e/x.mp4'],
    ['/archivos/%2e%2e/%2e%2e/x'],
    ['/archivos/videos/2026/09/a%00.mp4'],
    ['/archivos/videos//2026/09/x.mp4'],
    ['/archivos/videos/2026/09/%2F.mp4'],
    ['/archivos/'],
  ])('clave hostil %s → 404, nunca 5xx ni datos', async (r) => {
    const res = await ctx.http.get(r);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('dos aplicaciones sobre el mismo bucket (ya creado) arrancan y se leen entre sí', async () => {
    const bucket = bucketNuevo();
    const a = await crearApp({ entorno: entornoS3DePrueba(bucket) });
    const b = await crearApp({ entorno: entornoS3DePrueba(bucket) });
    try {
      const ua = await crearUsuario(a);
      const r = await a.http
        .post('/archivos')
        .set(ua.auth)
        .attach('archivo', jpeg(500), 'a.jpg')
        .expect(201);
      const p = new URL(r.body.datos.url as string).pathname;
      await b.http.get(p).expect(200);
    } finally {
      await a.cerrar();
      await b.cerrar();
    }
  });

  it('subidas simultáneas (10) → claves distintas, todas legibles', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 10 }, () =>
        ctx.http.post('/archivos').set(u.auth).attach('archivo', jpeg(700), 'a.jpg'),
      ),
    );
    const urls = respuestas.map((r) => r.body.datos.url as string);
    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    expect(new Set(urls).size).toBe(10);
    for (const url of urls) await ctx.http.get(new URL(url).pathname).expect(200);
  });

  it('un archivo de 5 MB justos sube y baja completo por S3', async () => {
    const grande = jpeg(5 * 1024 * 1024);
    const r = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', grande, 'g.jpg')
      .expect(201);
    const bajada = await ctx.http
      .get(new URL(r.body.datos.url as string).pathname)
      .buffer(true)
      .parse(binario)
      .expect(200);
    expect((bajada.body as Buffer).equals(grande)).toBe(true);
  });

  it('con CONFIAR_PROXY=true las URLs de S3 también salen https', async () => {
    const c = await crearApp({ entorno: { ...entornoS3DePrueba(), CONFIAR_PROXY: 'true' } });
    try {
      const usr = await crearUsuario(c);
      const r = await c.http
        .post('/archivos')
        .set(usr.auth)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'mi-api.onrender.com')
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(/^https:\/\/mi-api\.onrender\.com\/archivos\/imagenes\//);
    } finally {
      await c.cerrar();
    }
  });
});

describe('AGENTS §17.1 — ARCHIVOS_REDIRIGIR (adversarial)', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;

  beforeAll(async () => {
    ctx = await crearApp({ entorno: { ...entornoS3DePrueba(), ARCHIVOS_REDIRIGIR: 'true' } });
    u = await crearUsuario(ctx);
  });
  afterAll(() => ctx.cerrar());

  it('302 con Location firmada (15 min) y la subida sigue devolviendo la URL de la API, no la de S3', async () => {
    const r = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    expect(r.body.datos.url).toMatch(/\/archivos\/imagenes\//);
    expect(r.body.datos.url).not.toMatch(/X-Amz|:58080/);
    const g = await ctx.http.get(new URL(r.body.datos.url as string).pathname).redirects(0);
    expect(g.status).toBe(302);
    expect(g.headers.location).toMatch(/X-Amz-Expires=900/);
    expect(g.headers.location).toMatch(/X-Amz-Signature=/);
  });

  it.each([
    ['/archivos/imagenes/2026/09/noexisteunarchivoxx.jpg'],
    ['/archivos/imagenes/2026/09/../../../x'],
    ['/archivos/%2e%2e/x'],
  ])('clave inexistente o hostil (%s) → 404, no se firma una URL', async (r) => {
    const g = await ctx.http.get(r).redirects(0);
    expect(g.status).toBe(404);
    expect(g.headers.location).toBeUndefined();
  });

  it('con Range y redirección: sigue sin ser 5xx', async () => {
    const r = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', jpeg(1000), 'a.jpg')
      .expect(201);
    const g = await ctx.http
      .get(new URL(r.body.datos.url as string).pathname)
      .set('Range', 'bytes=0-9')
      .redirects(0);
    expect(g.status).toBeLessThan(500);
  });
});

describe('AGENTS §17.1 — el almacén S3 no responde', () => {
  it('con un S3_ENDPOINT que no existe la API no arranca y lo dice en castellano', async () => {
    const e = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: 'http://127.0.0.1:1',
        S3_BUCKET: 'x',
      },
    }).then(
      () => null,
      (err: Error) => err,
    );
    expect(e).not.toBeNull();
    expect(e?.message).toMatch(/archivos|almacén|S3/i);
  }, 60_000);
});
