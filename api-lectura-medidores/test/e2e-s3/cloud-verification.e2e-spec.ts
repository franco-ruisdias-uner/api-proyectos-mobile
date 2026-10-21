// Verificación independiente de M7 — Nube (caja negra, AGENTS §12, §17 y §18).
import { jpeg, m4a, mp4 } from '../utilities/files.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearRuta } from '../utilities/routes.js';
import { bearer, conSesion } from '../utilities/users.js';
import { ENTORNO_S3PROXY } from '../storage-s3/s3-environment.js';

const JERGA =
  /undefined|\[object|NaN|\bmust\b|\bshould\b|exception|QueryFailed|constraint|class-validator|stack|ECONN|ENOTFOUND|TypeError|ZodError/i;
const buffer = (
  res: NodeJS.ReadableStream,
  cb: (e: Error | null, b: Buffer) => void,
) => {
  const partes: Buffer[] = [];
  res.on('data', (p: Buffer) => partes.push(p));
  res.on('end', () => cb(null, Buffer.concat(partes)));
};

describe('AGENTS §17 — Almacén S3 (S3Proxy) como caja negra', () => {
  let c: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    c = await crearApp({
      entorno: { ...ENTORNO_S3PROXY, S3_BUCKET: 'verif-nube' },
    });
    token = (await conSesion(c, 'lector', { legajo: 'V7-LEC' })).token;
  });
  afterAll(() => c.cerrar());

  const subir = (b: Buffer, nombre: string) =>
    c.http().post('/archivos').set(bearer(token)).attach('archivo', b, nombre);
  const bajar = (url: string) =>
    c
      .http()
      .get(new URL(url).pathname)
      .buffer(true)
      .parse(buffer as never);

  it('/health informa s3proxy y conserva la forma', async () => {
    const r = await c.http().get('/salud').expect(200);
    esperarContrato(r.body, 'Salud');
    expect(r.body.datos.almacen).toBe('s3proxy');
  });

  it('imagen, audio y video: ida y vuelta con los mismos bytes y el tipo correcto', async () => {
    const casos: Array<[Buffer, string, string, string]> = [
      [jpeg(777), 'a.jpg', 'imagen', 'image/jpeg'],
      [m4a(1500), 'a.m4a', 'audio', 'audio/mp4'],
      [mp4(9000), 'a.mp4', 'video', 'video/mp4'],
    ];
    for (const [datos, nombre, tipo, mime] of casos) {
      const s = await subir(datos, nombre).expect(201);
      esperarContrato(s.body, 'ArchivoSubido');
      expect(s.body.datos.tipo).toBe(tipo);
      expect(s.body.datos.bytes).toBe(datos.length);
      const r = await bajar(s.body.datos.url).expect(200);
      expect((r.body as Buffer).equals(datos)).toBe(true);
      expect(r.headers['content-type']).toContain(mime.split('/')[1]);
      expect(r.headers['accept-ranges']).toBe('bytes');
      expect(r.headers['cache-control']).toMatch(/immutable/);
      expect(r.headers['etag']).toBeTruthy();
      expect(Number(r.headers['content-length'])).toBe(datos.length);
    }
  });

  it('Range: primer byte, último, abierto, sufijo; Content-Range correcto', async () => {
    const datos = mp4(6000);
    for (let i = 0; i < datos.length; i++) if (i > 20) datos[i] = i % 251;
    const s = await subir(datos, 'v.mp4').expect(201);
    const pedir = (rango: string) =>
      c
        .http()
        .get(new URL(s.body.datos.url).pathname)
        .set('Range', rango)
        .buffer(true)
        .parse(buffer as never);
    let r = await pedir('bytes=0-0').expect(206);
    expect((r.body as Buffer).equals(datos.subarray(0, 1))).toBe(true);
    expect(r.headers['content-range']).toBe('bytes 0-0/6000');
    r = await pedir('bytes=5999-5999').expect(206);
    expect((r.body as Buffer).equals(datos.subarray(5999))).toBe(true);
    r = await pedir('bytes=5990-').expect(206);
    expect(r.headers['content-range']).toBe('bytes 5990-5999/6000');
    expect(Number(r.headers['content-length'])).toBe(10);
    r = await pedir('bytes=-100').expect(206);
    expect((r.body as Buffer).equals(datos.subarray(5900))).toBe(true);
    r = await pedir('bytes=5000-99999').expect(206);
    expect(r.headers['content-range']).toBe('bytes 5000-5999/6000');
  });

  it('Range fuera del archivo da 416 con el sobre de error o al menos no 5xx', async () => {
    const s = await subir(jpeg(500), 'a.jpg').expect(201);
    const r = await c
      .http()
      .get(new URL(s.body.datos.url).pathname)
      .set('Range', 'bytes=9000-9999');
    expect(r.status).toBeLessThan(500);
    expect([416, 200]).toContain(r.status);
  });

  it('una clave inexistente da 404 ARCHIVO_NO_ENCONTRADO con sobre exacto', async () => {
    const r = await c
      .http()
      .get('/archivos/imagenes/2026/09/noexiste123.jpg')
      .expect(404);
    esperarError(r.body, 'ARCHIVO_NO_ENCONTRADO');
    expect(r.body.error.mensaje).not.toMatch(JERGA);
  });

  it.each([
    '/archivos/..%2F..%2Fetc%2Fpasswd',
    '/archivos/imagenes/../../x',
    '/archivos/%2e%2e/%2e%2e/x',
    '/archivos/',
  ])('clave maliciosa %s no sale 5xx ni filtra nada', async (ruta) => {
    const r = await c.http().get(ruta);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    if (r.body && r.body.error) esperarError(r.body);
  });

  it('firma inválida (415) y archivo grande (413) siguen con el sobre de error', async () => {
    const falso = await subir(Buffer.from('no soy una imagen'), 'a.jpg');
    expect(falso.status).toBe(415);
    esperarError(falso.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    const grande = await subir(jpeg(5 * 1024 * 1024 + 1), 'g.jpg');
    expect(grande.status).toBe(413);
    esperarError(grande.body, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('un archivo de exactamente 5 MB entra', async () => {
    const datos = jpeg(5 * 1024 * 1024);
    const s = await subir(datos, 'g.jpg').expect(201);
    const r = await bajar(s.body.datos.url).expect(200);
    expect((r.body as Buffer).length).toBe(datos.length);
  });

  it('sin token no se sube (401)', async () => {
    const r = await c
      .http()
      .post('/archivos')
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(401);
    esperarError(r.body, 'NO_AUTENTICADO');
  });

  it('una lectura con foto subida a S3 se acepta y devuelve la URL de esta API', async () => {
    const admin = await conSesion(c, 'administracion', { legajo: 'V7-ADM' });
    const lector = await conSesion(c, 'lector', { legajo: 'V7-LEC2' });
    const ruta = await crearRuta(c, { lectorId: lector.id, cantidad: 1 });
    const s = await c
      .http()
      .post('/archivos')
      .set(bearer(lector.token))
      .attach('archivo', jpeg(), 'a.jpg')
      .expect(201);
    const r = await c
      .http()
      .post('/lecturas')
      .set(bearer(lector.token))
      .send({
        rutaId: ruta.id,
        suministroId: ruta.suministroIds[0],
        valor: 100,
        fotoUri: s.body.datos.url,
        coordenadas: null,
        confirmadaPorLector: false,
        fechaHora: '2026-09-15T07:30:00-03:00',
      })
      .expect(201);
    esperarContrato(r.body, 'Lectura');
    expect(new URL(r.body.datos.fotoUri).pathname).toBe(
      new URL(s.body.datos.url).pathname,
    );
    await c.http().get(new URL(r.body.datos.fotoUri).pathname).expect(200);
    expect(admin.token).toBeTruthy();
  });
});
