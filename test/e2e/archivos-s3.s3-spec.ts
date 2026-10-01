import type { Response } from 'supertest';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg, mp4 } from '../utilidades/archivos.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { entornoS3DePrueba } from '../utilidades/s3.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';

function binario(respuesta: Response, listo: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer) => partes.push(parte));
  respuesta.on('end', () => listo(null, Buffer.concat(partes)));
}

describe('AGENTS §17.4 — archivos sobre S3 (S3Proxy)', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;

  beforeAll(async () => {
    ctx = await crearApp({ entorno: entornoS3DePrueba() });
    u = await crearUsuario(ctx);
  });
  afterAll(() => ctx.cerrar());

  it('/salud informa el proveedor', async () => {
    const r = await ctx.http.get('/salud').expect(200);
    expect(r.body.datos.almacen).toBe('s3proxy');
  });

  it('sube con POST /archivos, baja con la URL devuelta (mismos bytes) y pide un rango (206)', async () => {
    const contenido = jpeg(5000);
    const subida = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', contenido, 'foto.jpg')
      .expect(201);
    esperarContrato(subida.body, 'ArchivoSubido');
    const ruta = new URL(subida.body.datos.url as string).pathname;
    expect(ruta).toMatch(/^\/archivos\/imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/);

    const entero = await ctx.http.get(ruta).buffer(true).parse(binario).expect(200);
    expect(entero.headers['content-type']).toBe('image/jpeg');
    expect(entero.headers['accept-ranges']).toBe('bytes');
    expect((entero.body as Buffer).equals(contenido)).toBe(true);

    const rango = await ctx.http
      .get(ruta)
      .set('Range', 'bytes=10-19')
      .buffer(true)
      .parse(binario)
      .expect(206);
    expect(rango.headers['content-range']).toBe('bytes 10-19/5000');
    expect(rango.headers['content-length']).toBe('10');
    expect((rango.body as Buffer).equals(contenido.subarray(10, 20))).toBe(true);
  });

  it('un video: rango abierto "bytes=100-" hasta el final', async () => {
    const contenido = mp4(3000);
    const subida = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', contenido, 'v.mp4')
      .expect(201);
    const ruta = new URL(subida.body.datos.url as string).pathname;
    const r = await ctx.http
      .get(ruta)
      .set('Range', 'bytes=100-')
      .buffer(true)
      .parse(binario)
      .expect(206);
    expect(r.headers['content-range']).toBe('bytes 100-2999/3000');
    expect((r.body as Buffer).equals(contenido.subarray(100))).toBe(true);
  });

  it('una clave inexistente da 404 ARCHIVO_NO_ENCONTRADO', async () => {
    const r = await ctx.http.get('/archivos/imagenes/2026/09/noexiste123.jpg').expect(404);
    expect(r.body.error.codigo).toBe('ARCHIVO_NO_ENCONTRADO');
  });
});

describe('AGENTS §17.1 — ARCHIVOS_REDIRIGIR', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;

  beforeAll(async () => {
    ctx = await crearApp({ entorno: { ...entornoS3DePrueba(), ARCHIVOS_REDIRIGIR: 'true' } });
    u = await crearUsuario(ctx);
  });
  afterAll(() => ctx.cerrar());

  it('responde 302 a una URL firmada de 15 minutos que baja el archivo', async () => {
    const contenido = jpeg(2000);
    const subida = await ctx.http
      .post('/archivos')
      .set(u.auth)
      .attach('archivo', contenido, 'f.jpg')
      .expect(201);
    const ruta = new URL(subida.body.datos.url as string).pathname;
    const r = await ctx.http.get(ruta).redirects(0).expect(302);
    expect(r.headers.location).toMatch(/X-Amz-Expires=900/);
    const bajada = await fetch(r.headers.location as string);
    expect(Buffer.from(await bajada.arrayBuffer()).equals(contenido)).toBe(true);
  });

  it('una clave inexistente sigue dando 404 (no se firma una URL a la nada)', async () => {
    await ctx.http.get('/archivos/imagenes/2026/09/noexiste123.jpg').redirects(0).expect(404);
  });
});
