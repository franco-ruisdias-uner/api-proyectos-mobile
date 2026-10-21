import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conPatron, jpeg } from '../utilities/files.js';
import { levantarS3Falso, type S3Falso } from '../utilities/fake-s3.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

// AGENTS §17.4: subir con POST /archivos, bajar con la URL devuelta y pedir un rango, ahora con
// el almacén S3. Sin Docker corre contra un servidor de pruebas; la matriz usa S3Proxy (S3PROXY_URL).
describe('AGENTS §17 — Archivos en un servicio compatible con S3', () => {
  let falso: S3Falso;
  let t: AppDePrueba;
  let vecina: UsuarioDePrueba;
  const endpoint = () => process.env.S3PROXY_URL ?? falso.endpoint;

  beforeAll(async () => {
    falso = await levantarS3Falso();
    t = await crearApp({
      variables: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: endpoint(),
        S3_BUCKET: process.env.S3PROXY_URL ? 'archivos-e2e' : 'archivos',
      },
    });
    vecina = await crearUsuario(t);
  });
  afterAll(async () => {
    await t.cerrar();
    await falso.cerrar();
  });

  const subir = async () => {
    const original = conPatron(jpeg(3000));
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('archivo', original, 'f.jpg')
      .expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    return { original, ruta: new URL(res.body.datos.url).pathname };
  };

  it('/salud informa el proveedor en «almacen»', async () => {
    const res = await t.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(res.body.datos.almacen).toBe('s3proxy');
  });

  it('sube y baja los mismos bytes, con tipo y cabeceras de caché', async () => {
    const { original, ruta } = await subir();
    const res = await t
      .http()
      .get(ruta)
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (p: Buffer) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toContain('immutable');
    expect((res.body as Buffer).equals(original)).toBe(true);
  });

  it('un Range responde 206 con Content-Range', async () => {
    const { original, ruta } = await subir();
    const res = await t
      .http()
      .get(ruta)
      .set('Range', 'bytes=100-199')
      .buffer(true)
      .parse((r, cb) => {
        const partes: Buffer[] = [];
        r.on('data', (p: Buffer) => partes.push(p));
        r.on('end', () => cb(null, Buffer.concat(partes)));
      });
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 100-199/3000');
    expect((res.body as Buffer).equals(original.subarray(100, 200))).toBe(true);
  });

  it('una clave que no existe da 404 ARCHIVO_NO_ENCONTRADO', async () => {
    const res = await t.http().get('/archivos/imagenes/2026/10/nadanadanadanada.jpg').expect(404);
    esperarError(res.body, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('una URL de esta API con un archivo subido sirve como imagen de un recurso (existe)', async () => {
    const { ruta } = await subir();
    const archivos = t.app.get(
      (await import('../../src/common/files/files.service.js')).ArchivosServicio,
    );
    await expect(archivos.claveDeUrlSubida(`http://x${ruta}`)).resolves.toBe(
      ruta.replace('/archivos/', ''),
    );
    await expect(
      archivos.claveDeUrlSubida('http://x/archivos/imagenes/2026/10/nadanadanadanada.jpg'),
    ).rejects.toMatchObject({
      codigo: 'ARCHIVO_NO_SUBIDO',
    });
  });
});

describe.runIf(!process.env.S3PROXY_URL)('AGENTS §17.1 — Proveedor caído y redirección', () => {
  it('si el servicio no responde, 503 ALMACEN_NO_DISPONIBLE', async () => {
    const falso = await levantarS3Falso();
    const t = await crearApp({
      variables: { ARCHIVOS_PROVEEDOR: 's3proxy', S3_ENDPOINT: falso.endpoint },
    });
    const vecina = await crearUsuario(t);
    const { body } = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    const ruta = new URL(body.datos.url).pathname;
    await falso.cerrar();
    const res = await t.http().get(ruta).expect(503);
    esperarError(res.body, 'ALMACEN_NO_DISPONIBLE');
    await t.cerrar();
  });

  it('con ARCHIVOS_REDIRIGIR=true responde 302 a una URL firmada; sin ella, sirve el archivo', async () => {
    const falso = await levantarS3Falso();
    const t = await crearApp({
      variables: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: falso.endpoint,
        ARCHIVOS_REDIRIGIR: 'true',
      },
    });
    const vecina = await crearUsuario(t);
    const { body } = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    const ruta = new URL(body.datos.url).pathname;
    const res = await t.http().get(ruta).expect(302);
    expect(res.headers.location).toMatch(/X-Amz-Signature=/);
    expect(res.headers.location).toContain(falso.endpoint);
    await t.http().get('/archivos/imagenes/2026/10/nadanadanadanada.jpg').expect(404);
    await t.cerrar();
    await falso.cerrar();
  });
});
