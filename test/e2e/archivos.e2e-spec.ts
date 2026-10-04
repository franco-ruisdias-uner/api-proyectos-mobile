// AGENTS §8 y §17: subir con POST /archivos y bajar desde /archivos/<clave>, con Range.
import type { ArchivoSubido } from '../../contrato/api.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { jpeg, m4a, mp4, png } from '../utilidades/archivos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { registrarJugador } from '../utilidades/usuarios.js';

const MB = 1024 * 1024;

describe('POST /archivos — AGENTS §8', () => {
  let a: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    a = await crearApp();
    ({ token } = await registrarJugador(a));
  });
  afterAll(() => a.cerrar());

  const subir = (contenido: Buffer, nombre = 'foto.jpg', host?: string) => {
    const pedido = a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`);
    if (host) pedido.set('Host', host);
    return pedido.attach('archivo', contenido, nombre);
  };

  it.each([
    [
      'imagen jpeg',
      jpeg(),
      'imagen',
      /^imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/,
    ],
    ['imagen png', png(), 'imagen', /\.png$/],
    ['audio m4a', m4a(), 'audio', /^audios\/.+\.m4a$/],
    ['video mp4', mp4(), 'video', /^videos\/.+\.mp4$/],
  ])(
    '201 con url, tipo y bytes: %s',
    async (_caso, contenido, tipo, formaClave) => {
      const res = await subir(contenido).expect(201);
      const subido = esperarContrato<ArchivoSubido>(res.body, 'ArchivoSubido');
      expect(subido.tipo).toBe(tipo);
      expect(subido.bytes).toBe(contenido.length);
      const url = new URL(subido.url);
      expect(url.pathname.replace('/archivos/', '')).toMatch(formaClave);
    },
  );

  it('la clave la genera el servidor: el nombre que mandó el teléfono no aparece', async () => {
    const res = await subir(jpeg(), 'mi-cumple.jpg').expect(201);
    expect(res.body.datos.url).not.toContain('cumple');
  });

  it('la clave lleva el año y mes del reloj de la API, en hora argentina', async () => {
    const res = await subir(jpeg()).expect(201);
    expect(res.body.datos.url).toContain('/imagenes/2026/09/');
  });

  it('la URL usa el Host del pedido (la IP con la que llegó el teléfono)', async () => {
    const res = await subir(jpeg(), 'f.jpg', '10.0.0.5:3000').expect(201);
    expect(res.body.datos.url).toMatch(
      /^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\//,
    );
  });

  it('bajar con la URL devuelta trae los mismos bytes y las cabeceras de caché', async () => {
    const contenido = jpeg(5000);
    const { datos } = (await subir(contenido).expect(201)).body as {
      datos: ArchivoSubido;
    };
    const res = await a
      .http()
      .get(new URL(datos.url).pathname)
      .buffer(true)
      .expect(200);
    expect(Buffer.compare(res.body as Buffer, contenido)).toBe(0);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['content-length']).toBe('5000');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers.etag).toBeTruthy();
  });

  it('bajar es público (las fotos se ven sin cuenta)', async () => {
    const { datos } = (await subir(png()).expect(201)).body as {
      datos: ArchivoSubido;
    };
    await a.http().get(new URL(datos.url).pathname).expect(200);
  });

  it('Range: bytes=10-19 → 206 con esos 10 bytes y Content-Range', async () => {
    const contenido = m4a(4096);
    const { datos } = (await subir(contenido, 'a.m4a').expect(201)).body as {
      datos: ArchivoSubido;
    };
    const res = await a
      .http()
      .get(new URL(datos.url).pathname)
      .set('Range', 'bytes=10-19')
      .buffer(true)
      .expect(206);
    expect(Buffer.compare(res.body as Buffer, contenido.subarray(10, 20))).toBe(
      0,
    );
    expect(res.headers['content-range']).toBe('bytes 10-19/4096');
    expect(res.headers['content-length']).toBe('10');
  });

  it('Range: bytes=-1 → el último byte', async () => {
    const contenido = mp4(3000);
    const { datos } = (await subir(contenido, 'v.mp4').expect(201)).body as {
      datos: ArchivoSubido;
    };
    const res = await a
      .http()
      .get(new URL(datos.url).pathname)
      .set('Range', 'bytes=-1')
      .buffer(true)
      .expect(206);
    expect(Buffer.compare(res.body as Buffer, contenido.subarray(2999))).toBe(
      0,
    );
  });

  it('RANGO_NO_VALIDO (416) con un rango fuera del archivo', async () => {
    const { datos } = (await subir(mp4(3000), 'v.mp4').expect(201)).body as {
      datos: ArchivoSubido;
    };
    const res = await a
      .http()
      .get(new URL(datos.url).pathname)
      .set('Range', 'bytes=5000-');
    esperarError(res, 416, 'RANGO_NO_VALIDO');
    expect(res.headers['content-range']).toBe('bytes */3000');
  });

  it('ARCHIVO_NO_ENCONTRADO (404) con una clave que no existe o mal formada', async () => {
    esperarError(
      await a.http().get('/archivos/imagenes/2026/09/noexisteesteid.jpg'),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
    esperarError(
      await a.http().get('/archivos/%2e%2e%2fpackage.json'),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
    esperarError(
      await a.http().get('/archivos/cualquier/cosa.txt'),
      404,
      'ARCHIVO_NO_ENCONTRADO',
    );
  });

  it('TIPO_DE_ARCHIVO_NO_PERMITIDO (415): se mira la firma, no la extensión', async () => {
    esperarError(
      await subir(Buffer.from('esto es texto, no una foto'), 'foto.jpg'),
      415,
      'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    );
    esperarError(
      await subir(Buffer.from('%PDF-1.7 ...'), 'doc.pdf'),
      415,
      'TIPO_DE_ARCHIVO_NO_PERMITIDO',
    );
  });

  it('ARCHIVO_DEMASIADO_GRANDE (413): imagen de más de 5 MB', async () => {
    esperarError(
      await subir(jpeg(5 * MB + 1)),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('una imagen de 5 MB justos entra', async () => {
    await subir(jpeg(5 * MB)).expect(201);
  });

  it('ARCHIVO_DEMASIADO_GRANDE (413): audio de más de 10 MB', async () => {
    esperarError(
      await subir(m4a(10 * MB + 1), 'a.m4a'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('ARCHIVO_DEMASIADO_GRANDE (413): más de 30 MB, aunque sea video', async () => {
    esperarError(
      await subir(mp4(30 * MB + 1), 'v.mp4'),
      413,
      'ARCHIVO_DEMASIADO_GRANDE',
    );
  });

  it('VALIDACION_FALLIDA (400) sin archivo', async () => {
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .field('otro', 'x');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('NO_AUTENTICADO (401) sin sesión', async () => {
    esperarError(
      await a.http().post('/archivos').attach('archivo', jpeg(), 'f.jpg'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §8 — URL_PUBLICA manda sobre el Host', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp({
      entorno: { URL_PUBLICA: 'https://reservas.villaguay.gob.ar/' },
    });
  });
  afterAll(() => a.cerrar());

  it('las URLs salen con URL_PUBLICA', async () => {
    const { token } = await registrarJugador(a);
    const res = await a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .attach('archivo', jpeg(), 'f.jpg');
    expect(res.body.datos.url).toMatch(
      /^https:\/\/reservas\.villaguay\.gob\.ar\/archivos\/imagenes\//,
    );
  });
});

describe('AGENTS §18.2 — CONFIAR_PROXY y las cabeceras X-Forwarded-*', () => {
  const subirConProxy = async (a: AppDePrueba) => {
    const { token } = await registrarJugador(a);
    return a
      .http()
      .post('/archivos')
      .set('Authorization', `Bearer ${token}`)
      .set('Host', 'interno:10000')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'reservas.onrender.com')
      .attach('archivo', jpeg(), 'f.jpg');
  };

  it('con CONFIAR_PROXY=true las URLs salen https con el host público', async () => {
    const a = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      expect((await subirConProxy(a)).body.datos.url).toMatch(
        /^https:\/\/reservas\.onrender\.com\/archivos\//,
      );
    } finally {
      await a.cerrar();
    }
  });

  it('sin CONFIAR_PROXY las cabeceras se ignoran', async () => {
    const a = await crearApp();
    try {
      expect((await subirConProxy(a)).body.datos.url).toMatch(
        /^http:\/\/interno:10000\/archivos\//,
      );
    } finally {
      await a.cerrar();
    }
  });
});
