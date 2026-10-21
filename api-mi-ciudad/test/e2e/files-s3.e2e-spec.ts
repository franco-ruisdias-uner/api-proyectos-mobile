import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { MUESTRAS, registrarTurista, subirArchivo } from '../utilities/builders.js';
import { entornoS3Prueba, hayS3, S3_PRUEBA_ENDPOINT } from '../utilities/fake-s3.js';

// AGENTS §17.4: la misma API, con los archivos en S3 (S3Proxy). La app no se entera.
describe.runIf(hayS3)('AGENTS §17 — La API con los archivos en S3', () => {
  let ctx: AppDePrueba;
  let token: string;
  const audio = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
  audio.set([0, 0, 0, 0x20, ...Buffer.from('ftypM4A ', 'latin1')], 0);

  beforeAll(async () => {
    ctx = await crearApp({ entorno: entornoS3Prueba('e2e-archivos') });
    ({ token } = await registrarTurista(ctx));
  });
  afterAll(() => ctx.cerrar());

  it('/salud informa el proveedor en almacen', async () => {
    const res = await ctx.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(res.body.datos.almacen).toBe('s3proxy');
  });

  it('subir con POST /archivos y bajar con la URL devuelta: mismos bytes', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', audio, 'a.m4a')
      .expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    expect(res.body.datos.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/archivos\/audios\/\d{4}\/\d{2}\/[a-z0-9]{12}\.m4a$/,
    );
    const bajada = await ctx
      .http()
      .get(new URL(res.body.datos.url).pathname)
      .responseType('blob')
      .expect(200);
    expect(Buffer.compare(bajada.body as Buffer, audio)).toBe(0);
    expect(bajada.headers['content-type']).toBe('audio/mp4');
    expect(bajada.headers['accept-ranges']).toBe('bytes');
    expect(bajada.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('un rango devuelve 206 con esos bytes', async () => {
    const ruta = new URL(await subirArchivo(ctx, token, audio, 'a.m4a')).pathname;
    const res = await ctx.http().get(ruta).set('Range', 'bytes=10-19').responseType('blob').expect(206);
    expect(res.headers['content-range']).toBe('bytes 10-19/1000');
    expect(Buffer.compare(res.body as Buffer, audio.subarray(10, 20))).toBe(0);
    const ultimo = await ctx.http().get(ruta).set('Range', 'bytes=-1').responseType('blob').expect(206);
    expect(ultimo.headers['content-range']).toBe('bytes 999-999/1000');
  });

  it('RANGO_NO_SATISFACIBLE y ETag/304 funcionan igual que con el disco', async () => {
    const ruta = new URL(await subirArchivo(ctx, token, audio, 'a.m4a')).pathname;
    esperarError(await ctx.http().get(ruta).set('Range', 'bytes=5000-6000'), 416, 'RANGO_NO_SATISFACIBLE');
    const primera = await ctx.http().get(ruta);
    await ctx.http().get(ruta).set('If-None-Match', primera.headers.etag).expect(304);
  });

  it('ARCHIVO_NO_ENCONTRADO con una clave que no existe', async () => {
    esperarError(
      await ctx.http().get('/archivos/imagenes/2026/11/noexiste1234.jpg'),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
  });

  it('los tipos y tamaños se siguen validando antes de tocar el almacén', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set({ Authorization: `Bearer ${token}` })
      .attach('archivo', MUESTRAS.texto(), 'foto.jpg');
    esperarError(res, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
  });

  it('las semillas suben los medios de demo por el puerto: la audioguía se baja con Range', async () => {
    const sembrada = await crearApp({
      entorno: { ...entornoS3Prueba('e2e-semillas'), SEMBRAR_SI_VACIA: 'true' },
    });
    try {
      const lugar = await sembrada.http().get('/lugares/lug-004').expect(200);
      const url = new URL(lugar.body.datos.audioguia.url);
      const res = await sembrada
        .http()
        .get(url.pathname)
        .set('Range', 'bytes=0-99')
        .responseType('blob')
        .expect(206);
      expect((res.body as Buffer).length).toBe(100);
      expect(res.headers['content-type']).toBe('audio/mpeg');
    } finally {
      await sembrada.cerrar();
    }
  });
});

describe.runIf(hayS3)('AGENTS §17.1 — ARCHIVOS_REDIRIGIR: 302 a una URL firmada', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    // El preset «aws» apuntado al emulador con S3_ENDPOINT (con `s3proxy` no se permite redirigir).
    ctx = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 'aws',
        S3_ENDPOINT: S3_PRUEBA_ENDPOINT ?? '',
        S3_FORZAR_PATH_STYLE: 'true',
        S3_REGION: 'us-east-1',
        S3_BUCKET: 'e2e-redirigir',
        S3_ACCESS_KEY_ID: 'clave-de-mentira',
        S3_SECRET_ACCESS_KEY: 'secreto-de-mentira',
        ARCHIVOS_CREAR_BUCKET: 'true',
        ARCHIVOS_REDIRIGIR: 'true',
      },
    });
  });
  afterAll(() => ctx.cerrar());

  it('responde 302 con una URL firmada que sirve el archivo', async () => {
    const { token } = await registrarTurista(ctx);
    const ruta = new URL(await subirArchivo(ctx, token, MUESTRAS.png(300))).pathname;
    const res = await ctx.http().get(ruta).redirects(0).expect(302);
    expect(res.headers.location).toContain('X-Amz-Signature=');
    expect(res.headers['cache-control']).toBe('no-store');
    const directo = await fetch(res.headers.location);
    expect(directo.status).toBe(200);
    expect((await directo.arrayBuffer()).byteLength).toBe(300);
  });

  it('una clave que no existe sigue siendo 404 (no redirige)', async () => {
    esperarError(
      await ctx.http().get('/archivos/imagenes/2026/11/noexiste1234.png').redirects(0),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
  });
});

describe.runIf(hayS3)('AGENTS §17.1 — Si el almacén no responde, la API no arranca y lo dice', () => {
  it('con un endpoint que no contesta', async () => {
    await expect(
      crearApp({ entorno: { ...entornoS3Prueba('sin-servicio'), S3_ENDPOINT: 'http://127.0.0.1:1' } }),
    ).rejects.toThrow(/No se pudo usar el almacén de archivos.*no responde/);
  });
});
