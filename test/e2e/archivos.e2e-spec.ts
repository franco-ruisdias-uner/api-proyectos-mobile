import { ArchivosServicio } from '../../src/comun/archivos/archivos.servicio.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg, m4a, mp4 } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

const rutaDe = (url: string) => new URL(url).pathname;

describe('AGENTS §8 — Archivos', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp();
    token = (await conSesion(c, 'lector')).token;
  });
  afterAll(() => c.cerrar());

  const subir = (contenido: Buffer, nombre = 'foto.jpg') =>
    c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', contenido, nombre);

  describe('POST /archivos', () => {
    it('sube una foto: 201 con url, tipo y bytes; la URL usa el Host del pedido', async () => {
      const r = await subir(jpeg(1500))
        .set('Host', '10.0.0.5:3000')
        .expect(201);
      esperarContrato(r.body, 'ArchivoSubido');
      expect(r.body.datos).toEqual({
        url: expect.stringMatching(
          /^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\/2026\/09\/[a-z0-9]+\.jpg$/,
        ),
        tipo: 'imagen',
        bytes: 1500,
      });
    });

    it.each([
      [m4a(), 'nota.m4a', 'audio', /\/audios\/.+\.m4a$/],
      [mp4(), 'video.mp4', 'video', /\/videos\/.+\.mp4$/],
    ])('%#: sube %s como %s', async (contenido, nombre, tipo, patron) => {
      const r = await subir(contenido, nombre).expect(201);
      esperarContrato(r.body, 'ArchivoSubido');
      expect(r.body.datos.tipo).toBe(tipo);
      expect(r.body.datos.url).toMatch(patron);
    });

    it('la clave la genera el servidor, no sale del nombre que mandó el teléfono', async () => {
      const r = await subir(jpeg(), '../../../etc/passwd.jpg').expect(201);
      expect(r.body.datos.url).not.toMatch(/passwd|\.\./);
    });

    it('se mira la firma, no la extensión: un texto llamado foto.jpg → 415', async () => {
      const r = await subir(
        Buffer.from('esto no es una foto, es texto'),
        'foto.jpg',
      ).expect(415);
      esperarError(r.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    });

    it('una foto de más de 5 MB → 413 ARCHIVO_DEMASIADO_GRANDE', async () => {
      const r = await subir(jpeg(5 * 1024 * 1024 + 1)).expect(413);
      esperarError(r.body, 'ARCHIVO_DEMASIADO_GRANDE');
      expect(r.body.error.mensaje).toMatch(/5 MB/);
    });

    it('una foto de 5 MB justos entra', async () => {
      await subir(jpeg(5 * 1024 * 1024)).expect(201);
    });

    it('un audio de más de 10 MB → 413', async () => {
      esperarError(
        (await subir(m4a(10 * 1024 * 1024 + 1), 'a.m4a').expect(413)).body,
        'ARCHIVO_DEMASIADO_GRANDE',
      );
    });

    it('sin archivo → 400', async () => {
      const r = await c
        .http()
        .post('/archivos')
        .set(bearer(token))
        .field('otro', 'x')
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
    });

    it('sin sesión → 401', async () => {
      esperarError(
        (
          await c
            .http()
            .post('/archivos')
            .attach('archivo', jpeg(), 'f.jpg')
            .expect(401)
        ).body,
        'NO_AUTENTICADO',
      );
    });
  });

  describe('GET /archivos/<clave>', () => {
    let ruta: string;
    const contenido = Buffer.concat([
      jpeg(4),
      Buffer.from(Array.from({ length: 96 }, (_, i) => i)),
    ]);

    beforeAll(async () => {
      ruta = rutaDe((await subir(contenido).expect(201)).body.datos.url);
    });

    it('devuelve los mismos bytes con tipo, largo y caché', async () => {
      const r = await c.http().get(ruta).buffer(true).expect(200);
      expect(Buffer.from(r.body as Buffer).equals(contenido)).toBe(true);
      expect(r.headers['content-type']).toBe('image/jpeg');
      expect(r.headers['content-length']).toBe('100');
      expect(r.headers['accept-ranges']).toBe('bytes');
      expect(r.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(r.headers.etag).toBeTruthy();
    });

    it('con Range responde 206 con ese pedazo', async () => {
      const r = await c
        .http()
        .get(ruta)
        .set('Range', 'bytes=10-19')
        .buffer(true)
        .expect(206);
      expect(
        Buffer.from(r.body as Buffer).equals(contenido.subarray(10, 20)),
      ).toBe(true);
      expect(r.headers['content-range']).toBe('bytes 10-19/100');
      expect(r.headers['content-length']).toBe('10');
    });

    it('el último byte', async () => {
      const r = await c
        .http()
        .get(ruta)
        .set('Range', 'bytes=-1')
        .buffer(true)
        .expect(206);
      expect(r.headers['content-range']).toBe('bytes 99-99/100');
    });

    it('un rango fuera del archivo → 416 RANGO_NO_VALIDO', async () => {
      const r = await c
        .http()
        .get(ruta)
        .set('Range', 'bytes=500-600')
        .expect(416);
      esperarError(r.body, 'RANGO_NO_VALIDO');
      expect(r.headers['content-range']).toBe('bytes */100');
    });

    it.each([
      '/archivos/imagenes/2026/09/noexiste123.jpg',
      '/archivos/otra/cosa.txt',
      '/archivos/..%2F..%2Fpackage.json',
    ])('%s → 404 ARCHIVO_NO_ENCONTRADO', async (r) => {
      esperarError(
        (await c.http().get(r).expect(404)).body,
        'ARCHIVO_NO_ENCONTRADO',
      );
    });
  });

  describe('AGENTS §8 — Una URL que no es de esta API se rechaza con ARCHIVO_NO_SUBIDO', () => {
    it('acepta la URL de un archivo subido, aunque el teléfono lo haya subido por otra IP', async () => {
      const url: string = (await subir(jpeg()).expect(201)).body.datos.url;
      const otraIp = url.replace(/^http:\/\/[^/]+/, 'http://192.168.1.77:3000');
      await expect(
        c.app.get(ArchivosServicio).claveDeArchivoSubido(otraIp),
      ).resolves.toBe(rutaDe(url).replace('/archivos/', ''));
    });

    it.each([
      'file:///data/user/0/host.exp.exponent/cache/foto.jpg',
      'https://otro.sitio.com/foto.jpg',
      'http://localhost:3000/archivos/imagenes/2026/09/noexiste123.jpg',
      'cualquier cosa',
    ])('%s', async (url) => {
      await expect(
        c.app.get(ArchivosServicio).claveDeArchivoSubido(url),
      ).rejects.toMatchObject({ codigo: 'ARCHIVO_NO_SUBIDO', estado: 422 });
    });
  });
});
