import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearVecino, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import {
  JPEG,
  M4A,
  MP4,
  PDF,
  PNG,
  jpegDe,
  jpegNumerado,
} from '../utilidades/archivos.js';

let ctx: AppDePrueba;
let vecino: UsuarioDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ ahora: '2026-09-14T10:00:00-03:00' });
  vecino = await crearVecino(ctx);
});
afterAll(() => ctx.cerrar());

const subir = (contenido: Buffer, nombre = 'foto.jpg', app = ctx) =>
  app
    .http()
    .post('/archivos')
    .set(...vecino.auth)
    .attach('archivo', contenido, nombre);

/** Supertest junta el cuerpo binario en un Buffer. */
const binario = (req: ReturnType<ReturnType<AppDePrueba['http']>['get']>) =>
  req.buffer(true).parse((res, cb) => {
    const partes: Buffer[] = [];
    res.on('data', (p: Buffer) => partes.push(p));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });

const ruta = (url: string) => new URL(url).pathname;

describe('POST /archivos', () => {
  it('AGENTS §8 — sube una imagen y devuelve url absoluta, tipo y bytes', async () => {
    const res = await subir(JPEG).set('Host', '10.0.0.5:3000');
    expect(res.status).toBe(201);
    esperarContrato(res, 'ArchivoSubido');
    expect(res.body.datos).toEqual({
      url: expect.stringMatching(
        /^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\/2026\/09\/[a-z0-9]{24}\.jpg$/,
      ),
      tipo: 'imagen',
      bytes: JPEG.length,
    });
  });

  it.each([
    ['png', PNG, 'foto.png', 'imagen', /\.png$/],
    [
      'm4a',
      M4A,
      'nota.m4a',
      'audio',
      /^http:\/\/[^/]+\/archivos\/audios\/.*\.m4a$/,
    ],
    [
      'mp4',
      MP4,
      'video.mp4',
      'video',
      /^http:\/\/[^/]+\/archivos\/videos\/.*\.mp4$/,
    ],
  ])('acepta %s', async (_caso, contenido, nombre, tipo, url) => {
    const res = await subir(contenido, nombre);
    expect(res.status).toBe(201);
    expect(res.body.datos.tipo).toBe(tipo);
    expect(res.body.datos.url).toMatch(url);
  });

  it('la clave la genera el servidor, no el nombre que mandó el usuario', async () => {
    const res = await subir(JPEG, '../../../etc/passwd.jpg');
    expect(res.status).toBe(201);
    expect(res.body.datos.url).not.toContain('passwd');
  });

  it('AGENTS §8 — 415 TIPO_DE_ARCHIVO_NO_PERMITIDO por la firma, aunque diga .jpg', async () => {
    esperarError(
      await subir(PDF, 'foto.jpg'),
      415,
      'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    );
  });

  it('AGENTS §8 — 413 ARCHIVO_DEMASIADO_GRANDE: imagen de más de 5 MB', async () => {
    esperarError(
      await subir(jpegDe(5 * 1024 * 1024 + 1)),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('una imagen de exactamente 5 MB entra', async () => {
    expect((await subir(jpegDe(5 * 1024 * 1024))).status).toBe(201);
  });

  it('413 con cualquier archivo de más de 30 MB', async () => {
    esperarError(
      await subir(jpegDe(30 * 1024 * 1024 + 1), 'x.mp4'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('400 si no viene el archivo', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...vecino.auth)
      .field('otra', 'cosa');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('400 si el archivo viene en otro campo', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set(...vecino.auth)
      .attach('foto', JPEG, 'foto.jpg');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toMatch(/archivo/);
  });

  it('401 sin sesión', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .attach('archivo', JPEG, 'foto.jpg');
    esperarError(res, 401, 'NO_AUTENTICADO');
  });
});

describe('GET /archivos/<clave>', () => {
  it('AGENTS §17.1 — devuelve los mismos bytes, con tipo y caché', async () => {
    const contenido = jpegNumerado(1000);
    const { body } = await subir(contenido);
    const res = await binario(ctx.http().get(ruta(body.datos.url)));
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['content-length']).toBe('1000');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['etag']).toBeTruthy();
  });

  it('es público: la app lo muestra con <Image> sin cabecera de sesión', async () => {
    const { body } = await subir(JPEG);
    expect((await ctx.http().get(ruta(body.datos.url))).status).toBe(200);
  });

  it('AGENTS §8 — pide un rango y recibe 206 con esos bytes', async () => {
    const contenido = jpegNumerado(1000);
    const { body } = await subir(contenido);
    const res = await binario(
      ctx.http().get(ruta(body.datos.url)).set('Range', 'bytes=10-19'),
    );
    expect(res.status).toBe(206);
    expect(Buffer.compare(res.body as Buffer, contenido.subarray(10, 20))).toBe(
      0,
    );
    expect(res.headers['content-range']).toBe('bytes 10-19/1000');
    expect(res.headers['content-length']).toBe('10');
  });

  it('el último byte', async () => {
    const contenido = jpegNumerado(1000);
    const { body } = await subir(contenido);
    const res = await binario(
      ctx.http().get(ruta(body.datos.url)).set('Range', 'bytes=-1'),
    );
    expect(res.status).toBe(206);
    expect([...(res.body as Buffer)]).toEqual([contenido[999]]);
    expect(res.headers['content-range']).toBe('bytes 999-999/1000');
  });

  it('416 RANGO_NO_SATISFACIBLE fuera del archivo', async () => {
    const { body } = await subir(jpegNumerado(1000));
    const res = await ctx
      .http()
      .get(ruta(body.datos.url))
      .set('Range', 'bytes=5000-');
    esperarError(res, 416, 'RANGO_NO_SATISFACIBLE');
    expect(res.headers['content-range']).toBe('bytes */1000');
  });

  it('AGENTS §17.1 — 404 ARCHIVO_NO_ENCONTRADO con una clave que no existe', async () => {
    const res = await ctx
      .http()
      .get('/archivos/imagenes/2026/09/abcdefghabcdefghabcdefgh.jpg');
    esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it.each([
    ['/archivos/imagenes/2026/09/..%2F..%2Fpackage.json'],
    ['/archivos/../package.json'],
    ['/archivos/otra/cosa.jpg'],
  ])('404 con una clave inválida: %s', async (camino) => {
    const res = await ctx.http().get(camino);
    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toMatch(
      /ARCHIVO_NO_ENCONTRADO|RUTA_NO_ENCONTRADA/,
    );
  });
});

describe('AGENTS §8 y §18.2 — Origen de las URLs', () => {
  it('sin URL_PUBLICA usa el Host del pedido', async () => {
    const res = await subir(JPEG).set('Host', '192.168.0.10:3000');
    expect(res.body.datos.url).toMatch(
      /^http:\/\/192\.168\.0\.10:3000\/archivos\//,
    );
  });

  it('sin CONFIAR_PROXY ignora X-Forwarded-*', async () => {
    const res = await subir(JPEG)
      .set('Host', '192.168.0.10:3000')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'api.ejemplo.com');
    expect(res.body.datos.url).toMatch(/^http:\/\/192\.168\.0\.10:3000\//);
  });

  it('con CONFIAR_PROXY=true usa X-Forwarded-Proto y X-Forwarded-Host (URLs https)', async () => {
    const proxy = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const v = await crearVecino(proxy);
      const res = await proxy
        .http()
        .post('/archivos')
        .set(...v.auth)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.ejemplo.com')
        .attach('archivo', JPEG, 'foto.jpg');
      expect(res.body.datos.url).toMatch(
        /^https:\/\/api\.ejemplo\.com\/archivos\/imagenes\//,
      );
    } finally {
      await proxy.cerrar();
    }
  });

  it('con URL_PUBLICA usa esa', async () => {
    const publica = await crearApp({
      entorno: { URL_PUBLICA: 'https://api.ejemplo.com/' },
    });
    try {
      const v = await crearVecino(publica);
      const res = await publica
        .http()
        .post('/archivos')
        .set(...v.auth)
        .attach('archivo', JPEG, 'foto.jpg');
      expect(res.body.datos.url).toMatch(
        /^https:\/\/api\.ejemplo\.com\/archivos\/imagenes\//,
      );
    } finally {
      await publica.cerrar();
    }
  });
});
