import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { conPatron, jpeg, m4a, mp4, png } from '../utilidades/archivos.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import { ArchivosServicio, urlDeArchivo } from '../../src/comun/archivos/archivos.servicio.js';
import { conOrigen } from '../../src/comun/contexto/contexto-pedido.js';

const MB = 1024 * 1024;

describe('AGENTS §8 — POST /archivos', () => {
  let t: AppDePrueba;
  let vecina: UsuarioDePrueba;
  beforeAll(async () => {
    t = await crearApp();
    vecina = await crearUsuario(t);
  });
  afterAll(() => t.cerrar());

  const subir = (contenido: Buffer, nombre = 'foto.jpg') =>
    t.http().post('/archivos').set(vecina.auth).attach('archivo', contenido, nombre);

  it.each([
    ['jpeg', jpeg(), 'imagen', /^imagenes\/\d{4}\/\d{2}\/[a-z0-9]{16}\.jpg$/],
    ['png', png(), 'imagen', /\.png$/],
    ['mp4', mp4(), 'video', /^videos\/.*\.mp4$/],
    ['m4a', m4a(), 'audio', /^audios\/.*\.m4a$/],
  ])('201 con %s: devuelve url absoluta, tipo y bytes', async (_n, contenido, tipo, forma) => {
    const res = await subir(contenido).expect(201);
    esperarContrato(res.body, 'ArchivoSubido');
    expect(res.body.datos.tipo).toBe(tipo);
    expect(res.body.datos.bytes).toBe(contenido.length);
    const url = new URL(res.body.datos.url);
    expect(url.pathname.replace(/^\/archivos\//, '')).toMatch(forma);
  });

  it('la clave la genera el servidor: el nombre del archivo no aparece', async () => {
    const res = await subir(jpeg(), '../../etc/passwd.jpg').expect(201);
    expect(res.body.datos.url).not.toContain('passwd');
  });

  it('se reconoce por la firma: un texto con nombre .jpg es 415', async () => {
    const res = await subir(Buffer.from('esto no es una foto'), 'foto.jpg').expect(415);
    esperarError(res.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
  });

  it('415 con un PDF', async () => {
    const res = await subir(Buffer.from('%PDF-1.7\n...'), 'doc.pdf').expect(415);
    esperarError(res.body, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
  });

  it('413 ARCHIVO_DEMASIADO_GRANDE: una imagen de más de 5 MB', async () => {
    const res = await subir(jpeg(5 * MB + 1)).expect(413);
    esperarError(res.body, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('una imagen de 5 MB justos entra', async () => {
    await subir(jpeg(5 * MB)).expect(201);
  });

  it('413 ARCHIVO_DEMASIADO_GRANDE: más de 30 MB, aunque sea video', async () => {
    const res = await subir(mp4(30 * MB + 1), 'video.mp4').expect(413);
    esperarError(res.body, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('400 VALIDACION_FALLIDA sin archivo', async () => {
    const res = await t.http().post('/archivos').set(vecina.auth).field('otra', 'cosa').expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('400 VALIDACION_FALLIDA con el archivo en otro campo', async () => {
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('foto', jpeg(), 'f.jpg')
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('401 NO_AUTENTICADO sin sesión', async () => {
    const res = await t.http().post('/archivos').attach('archivo', jpeg(), 'f.jpg').expect(401);
    esperarError(res.body, 'NO_AUTENTICADO');
  });
});

describe('AGENTS §8 / §17.1 — GET /archivos/<clave>', () => {
  let t: AppDePrueba;
  let vecina: UsuarioDePrueba;
  let video: Buffer;
  let ruta: string;
  beforeAll(async () => {
    t = await crearApp();
    vecina = await crearUsuario(t);
    video = conPatron(mp4(1000));
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('archivo', video, 'v.mp4')
      .expect(201);
    ruta = new URL(res.body.datos.url).pathname;
  });
  afterAll(() => t.cerrar());

  it('200 público con los mismos bytes y las cabeceras de caché', async () => {
    const res = await t.http().get(ruta).buffer(true).expect(200);
    expect(Buffer.compare(res.body as Buffer, video)).toBe(0);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.headers['content-length']).toBe('1000');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers.etag).toBeTruthy();
  });

  it('206 con Range: bytes 10 a 19', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=10-19').buffer(true).expect(206);
    expect([...(res.body as Buffer)]).toEqual([...video.subarray(10, 20)]);
    expect(res.headers['content-range']).toBe('bytes 10-19/1000');
    expect(res.headers['content-length']).toBe('10');
  });

  it('206 con el final abierto (bytes=990-) y con sufijo (bytes=-5)', async () => {
    const a = await t.http().get(ruta).set('Range', 'bytes=990-').buffer(true).expect(206);
    expect([...(a.body as Buffer)]).toEqual([...video.subarray(990)]);
    expect(a.headers['content-range']).toBe('bytes 990-999/1000');
    const b = await t.http().get(ruta).set('Range', 'bytes=-5').buffer(true).expect(206);
    expect([...(b.body as Buffer)]).toEqual([...video.subarray(995)]);
  });

  it('416 RANGO_NO_SATISFACIBLE si el rango empieza después del final', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=5000-6000').expect(416);
    esperarError(res.body, 'RANGO_NO_SATISFACIBLE');
    expect(res.headers['content-range']).toBe('bytes */1000');
  });

  it('un Range que no se entiende se ignora: 200 con el archivo entero', async () => {
    const res = await t.http().get(ruta).set('Range', 'bytes=a-b').buffer(true).expect(200);
    expect((res.body as Buffer).length).toBe(1000);
  });

  it('404 ARCHIVO_NO_ENCONTRADO con una clave válida que no existe', async () => {
    const res = await t.http().get('/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg').expect(404);
    esperarError(res.body, 'ARCHIVO_NO_ENCONTRADO');
  });

  it.each([
    ['/archivos/no-es-una-clave'],
    ['/archivos/imagenes/2026/10/..%2F..%2F..%2Fpackage.json'],
    ['/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.exe'],
  ])('404 ARCHIVO_NO_ENCONTRADO con %s', async (camino) => {
    const res = await t.http().get(camino).expect(404);
    esperarError(res.body);
  });
});

describe('AGENTS §8 — Las URLs usan el origen del pedido', () => {
  it('con Host: 10.0.0.5:3000 la URL sale con ese origen', async () => {
    const t = await crearApp();
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .set('Host', '10.0.0.5:3000')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\//);
    await t.cerrar();
  });

  it('400 VALIDACION_FALLIDA si el Host no es una dirección válida', async () => {
    const t = await crearApp();
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .set('Host', 'mala"<script>')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
    await t.cerrar();
  });

  it('con URL_PUBLICA definida gana ésa', async () => {
    const t = await crearApp({ variables: { URL_PUBLICA: 'https://api.ejemplo.com/' } });
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .set('Host', '10.0.0.5:3000')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.com\/archivos\/imagenes\//);
    await t.cerrar();
  });

  it('AGENTS §18.2 — Con CONFIAR_PROXY=true, X-Forwarded-Proto/Host dan una URL https', async () => {
    const t = await crearApp({ variables: { CONFIAR_PROXY: 'true' } });
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'mi-api.onrender.com')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/^https:\/\/mi-api\.onrender\.com\/archivos\//);
    await t.cerrar();
  });

  it('sin CONFIAR_PROXY, las cabeceras X-Forwarded-* se ignoran', async () => {
    const t = await crearApp();
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .set('Host', '10.0.0.5:3000')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'mi-api.onrender.com')
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    expect(res.body.datos.url).toMatch(/^http:\/\/10\.0\.0\.5:3000\//);
    await t.cerrar();
  });
});

describe('AGENTS §8 — ARCHIVO_NO_SUBIDO: una URL en un recurso tiene que ser de /archivos', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('acepta una URL subida antes (con cualquier origen) y devuelve su clave', async () => {
    const vecina = await crearUsuario(t);
    const res = await t
      .http()
      .post('/archivos')
      .set(vecina.auth)
      .attach('archivo', jpeg(), 'f.jpg')
      .expect(201);
    const clave = new URL(res.body.datos.url).pathname.replace('/archivos/', '');
    const servicio = t.app.get(ArchivosServicio);
    await expect(servicio.claveDeUrlSubida(res.body.datos.url)).resolves.toBe(clave);
    await expect(
      servicio.claveDeUrlSubida(`http://192.168.0.99:3000/archivos/${clave}`),
    ).resolves.toBe(clave);
  });

  it.each([
    ['https://otro.com/foto.jpg'],
    ['file:///storage/emulated/0/DCIM/foto.jpg'],
    ['http://localhost:3000/archivos/imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg'],
  ])('rechaza %s', async (url) => {
    await expect(t.app.get(ArchivosServicio).claveDeUrlSubida(url)).rejects.toMatchObject({
      codigo: 'ARCHIVO_NO_SUBIDO',
      estado: 422,
    });
  });

  it('urlDeArchivo arma la URL con el origen del pedido en curso', () => {
    const clave = 'imagenes/2026/10/aaaaaaaaaaaaaaaa.jpg';
    expect(conOrigen('http://10.0.0.5:3000', () => urlDeArchivo(clave))).toBe(
      `http://10.0.0.5:3000/archivos/${clave}`,
    );
  });
});
