// AGENTS §17.4: subir con POST /archivos y bajar con la URL devuelta, con proveedor S3.
// Usa un S3 falso en memoria; en la matriz (S3_PRUEBAS_ENDPOINT) usa S3Proxy real.
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { levantarS3Falso, type S3Falso } from '../utilidades/s3-falso.js';
import { registrarJugador } from '../utilidades/usuarios.js';
import type { Salud } from '../../contrato/api.js';

describe('AGENTS §17 — archivos con el proveedor S3', () => {
  let a: AppDePrueba;
  let falso: S3Falso | null = null;
  let token: string;

  beforeAll(async () => {
    let endpoint = process.env.S3_PRUEBAS_ENDPOINT;
    if (!endpoint) {
      falso = await levantarS3Falso();
      endpoint = falso.endpoint;
    }
    a = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    ({ token } = await registrarJugador(a));
  });
  afterAll(async () => {
    await a.cerrar();
    await falso?.cerrar();
  });

  const subir = async (contenido: Buffer) => {
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', contenido, 'foto.jpg')
      .expect(201);
    return new URL(
      esperarContrato<{ url: string }>(res.body, 'ArchivoSubido').url,
    ).pathname;
  };

  it('/salud informa el proveedor en almacen', async () => {
    const res = await a.http().get('/salud').expect(200);
    expect(esperarContrato<Salud>(res.body, 'Salud').almacen).toBe('s3proxy');
  });

  it('lo que se sube se baja igual, con su tipo y las cabeceras de caché', async () => {
    const contenido = jpeg(3000);
    const ruta = await subir(contenido);
    const res = await a
      .http()
      .get(ruta)
      .buffer(true)
      .parse((r, cb) => {
        const t: Buffer[] = [];
        r.on('data', (x: Buffer) => t.push(x));
        r.on('end', () => cb(null, Buffer.concat(t)));
      })
      .expect(200);
    expect(res.body).toEqual(contenido);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('un rango responde 206 con Content-Range y el total', async () => {
    const contenido = jpeg(3000);
    const ruta = await subir(contenido);
    const res = await a
      .http()
      .get(ruta)
      .set('Range', 'bytes=10-19')
      .buffer(true)
      .parse((r, cb) => {
        const t: Buffer[] = [];
        r.on('data', (x: Buffer) => t.push(x));
        r.on('end', () => cb(null, Buffer.concat(t)));
      })
      .expect(206);
    expect(res.headers['content-range']).toBe('bytes 10-19/3000');
    expect(res.body).toEqual(contenido.subarray(10, 20));
  });

  it('una clave que no existe es 404 ARCHIVO_NO_ENCONTRADO', async () => {
    const res = await a
      .http()
      .get('/archivos/imagenes/2026/09/noexiste123456.jpg');
    esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
  });

  it('con el proveedor caído, subir da 503 ALMACEN_NO_DISPONIBLE', async () => {
    if (!falso) return; // con S3Proxy real no se lo puede apagar desde acá
    const caido = await levantarS3Falso();
    const b = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: caido.endpoint,
        S3_BUCKET: 'archivos',
      },
    });
    const { token: t } = await registrarJugador(b);
    await caido.cerrar();
    const res = await b
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${t}`)
      .attach('archivo', jpeg(), 'foto.jpg');
    esperarError(res, 503, 'ALMACEN_NO_DISPONIBLE');
    await b.cerrar();
  }, 30_000);
});
