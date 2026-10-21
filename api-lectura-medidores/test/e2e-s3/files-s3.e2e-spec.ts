import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { jpeg, mp4 } from '../utilities/files.js';
import { esperarContrato } from '../utilities/contract.js';
import { bearer, conSesion } from '../utilities/users.js';
import { ENTORNO_S3PROXY } from '../storage-s3/s3-environment.js';

const rutaDe = (url: string) => new URL(url).pathname;

describe('AGENTS §17.4 — Archivos con un proveedor S3 (S3Proxy)', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp({
      entorno: { ...ENTORNO_S3PROXY, S3_BUCKET: 'e2e-archivos' },
    });
    token = (await conSesion(c, 'lector')).token;
  });
  afterAll(() => c.cerrar());

  it('/health informa el proveedor en almacen', async () => {
    const r = await c.http().get('/salud').expect(200);
    expect(r.body.datos.almacen).toBe('s3proxy');
  });

  it('sube con POST /archivos y baja con la URL devuelta: mismos bytes', async () => {
    const foto = jpeg(3000);
    const subida = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', foto, 'f.jpg')
      .expect(201);
    esperarContrato(subida.body, 'ArchivoSubido');
    const bajada = await c
      .http()
      .get(rutaDe(subida.body.datos.url))
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (p: Buffer) => partes.push(p));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(200);
    expect(bajada.headers['content-type']).toBe('image/jpeg');
    expect((bajada.body as Buffer).equals(foto)).toBe(true);
  });

  it('un rango pedido a la API responde 206 con Content-Range', async () => {
    const video = mp4(5000);
    const subida = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', video, 'v.mp4')
      .expect(201);
    const r = await c
      .http()
      .get(rutaDe(subida.body.datos.url))
      .set('Range', 'bytes=100-199')
      .buffer(true)
      .parse((res, cb) => {
        const partes: Buffer[] = [];
        res.on('data', (p: Buffer) => partes.push(p));
        res.on('end', () => cb(null, Buffer.concat(partes)));
      })
      .expect(206);
    expect(r.headers['content-range']).toBe('bytes 100-199/5000');
    expect((r.body as Buffer).equals(video.subarray(100, 200))).toBe(true);
  });

  it('una clave que no existe: 404 ARCHIVO_NO_ENCONTRADO', async () => {
    const r = await c
      .http()
      .get('/archivos/imagenes/2026/09/abcdefgh1234.jpg')
      .expect(404);
    expect(r.body.error.codigo).toBe('ARCHIVO_NO_ENCONTRADO');
  });

  it('un archivo subido sirve como fotoUri: la API lo reconoce', async () => {
    const subida = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    const { ArchivosServicio } =
      await import('../../src/common/files/files.service.js');
    await expect(
      c.app.get(ArchivosServicio).claveDeArchivoSubido(subida.body.datos.url),
    ).resolves.toMatch(/^imagenes\//);
  });
});

describe('AGENTS §17.1 — STORAGE_REDIRECT', () => {
  let c: AppDePrueba;
  beforeAll(async () => {
    c = await crearApp({
      entorno: {
        ...ENTORNO_S3PROXY,
        S3_BUCKET: 'e2e-redirigir',
        STORAGE_REDIRECT: 'true',
      },
    });
  });
  afterAll(() => c.cerrar());

  it('responde 302 a una URL firmada, también para una clave existente', async () => {
    const { token } = await conSesion(c, 'lector');
    const subida = await c
      .http()
      .post('/archivos')
      .set(bearer(token))
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    const r = await c.http().get(rutaDe(subida.body.datos.url)).expect(302);
    expect(r.headers.location).toMatch(/X-Amz-Signature=/);
    expect(r.headers.location).toContain('e2e-redirigir');
  });

  it('con una clave que no existe: 404 y no una redirección', async () => {
    await c
      .http()
      .get('/archivos/imagenes/2026/09/zzzzzzzz9999.jpg')
      .expect(404);
  });
});
