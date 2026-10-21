import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import {
  claveDe,
  conSesion,
  crearCategoria,
  crearLugar,
  MUESTRAS,
  registrarTurista,
  subirArchivo,
} from '../utilities/builders.js';
import { entornoS3Prueba, hayS3 } from '../utilities/fake-s3.js';

const audio = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
audio.set([0, 0, 0, 0x20, ...Buffer.from('ftypM4A ', 'latin1')], 0);

/** Los mismos chequeos de archivos con cualquier proveedor. */
function pruebasDeArchivos(
  nombre: string,
  entorno: () => Record<string, string> | undefined,
  proveedor: string,
) {
  describe(`M6 — ${nombre}: /salud, Range y errores de archivos (AGENTS §17.1)`, () => {
    let ctx: AppDePrueba;
    let token: string;
    let ruta: string;
    beforeAll(async () => {
      ctx = await crearApp({ entorno: entorno() });
      ({ token } = await registrarTurista(ctx));
      ruta = new URL(await subirArchivo(ctx, token, audio, 'a.m4a')).pathname;
    });
    afterAll(() => ctx.cerrar());

    it('/salud es público, informa almacen y no trae campos de más', async () => {
      const res = await ctx.http().get('/salud').expect(200);
      esperarContrato(res.body, 'Salud');
      expect(res.body.datos.almacen).toBe(proveedor);
      expect(Object.keys(res.body.datos).sort()).toEqual(['almacen', 'estado', 'motor', 'version']);
      expect(res.body.meta).toBeNull();
    });

    it('GET /archivos/<clave> es público, con las cabeceras del §17.1', async () => {
      const res = await ctx.http().get(ruta).responseType('blob').expect(200);
      expect(Buffer.compare(res.body as Buffer, audio)).toBe(0);
      expect(res.headers['content-length']).toBe('1000');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(res.headers['content-type']).toBe('audio/mp4');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(res.headers.etag).toBeTruthy();
    });

    it.each([
      ['bytes=0-0', 'bytes 0-0/1000', 1],
      ['bytes=0-', 'bytes 0-999/1000', 1000],
      ['bytes=990-5000', 'bytes 990-999/1000', 10],
      ['bytes=-10', 'bytes 990-999/1000', 10],
      ['bytes=999-999', 'bytes 999-999/1000', 1],
      ['bytes=0-999', 'bytes 0-999/1000', 1000],
    ])('Range %s → 206 %s', async (rango, contentRange, largo) => {
      const res = await ctx.http().get(ruta).set('Range', rango).responseType('blob').expect(206);
      expect(res.headers['content-range']).toBe(contentRange);
      expect(res.headers['content-length']).toBe(String(largo));
      expect((res.body as Buffer).length).toBe(largo);
      const [ini] = contentRange.replace('bytes ', '').split('-').map(Number);
      expect((res.body as Buffer)[0]).toBe(audio[ini]);
      expect(res.headers['accept-ranges']).toBe('bytes');
    });

    it.each(['bytes=1000-', 'bytes=1000-1200', 'bytes=2000-3000'])(
      'Range %s (fuera del archivo) → 416 RANGO_NO_SATISFACIBLE con sobre de error',
      async (rango) => {
        const res = await ctx.http().get(ruta).set('Range', rango);
        esperarError(res, 416, 'RANGO_NO_SATISFACIBLE');
        expect(res.headers['content-range']).toBe('bytes */1000');
        expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
      },
    );

    it.each(['bytes=abc', 'bytes=5-2', 'items=0-5', 'bytes=', 'bytes=0-1,5-6'])(
      'Range raro %s: nunca 500 (200 completo, 206 o 416)',
      async (rango) => {
        const res = await ctx.http().get(ruta).set('Range', rango).responseType('blob');
        expect([200, 206, 416]).toContain(res.status);
        if (res.status === 416)
          esperarError({ status: 416, body: JSON.parse(res.body.toString()) }, 416, 'RANGO_NO_SATISFACIBLE');
      },
    );

    it('HEAD no revienta', async () => {
      const res = await ctx.http().head(ruta);
      expect(res.status).toBeLessThan(500);
    });

    it.each([
      '/archivos/imagenes/2026/11/noexiste1234.jpg',
      '/archivos/audios/2030/01/zzzzzzzzzzzz.m4a',
      '/archivos/videos/2026/11/noexiste1234.mp4',
      '/archivos/x',
      '/archivos/imagenes/2026/11/%2e%2e%2f%2e%2e%2fsecreto.jpg',
      '/archivos/imagenes/../../../etc/passwd',
      '/archivos/imagenes//2026/11/a.jpg',
    ])('clave inexistente o rara %s → 404 con sobre exacto', async (camino) => {
      const res = await ctx.http().get(camino);
      expect(res.status).toBe(404);
      esperarError(res, 404, res.body.error.codigo);
      expect(['ARCHIVO_NO_ENCONTRADO', 'RUTA_NO_ENCONTRADA']).toContain(res.body.error.codigo);
    });

    it('la clave inexistente devuelve exactamente ARCHIVO_NO_ENCONTRADO', async () => {
      esperarError(
        await ctx.http().get('/archivos/imagenes/2026/11/noexiste1234.jpg'),
        404,
        'ARCHIVO_NO_ENCONTRADO',
      );
    });

    it('con ARCHIVOS_REDIRIGIR desactivado nunca redirige', async () => {
      const res = await ctx.http().get(ruta).redirects(0);
      expect(res.status).toBe(200);
    });

    it('subir sin token → 401; tipo no permitido → 415; el sobre es exacto', async () => {
      esperarError(
        await ctx.http().post('/archivos').attach('archivo', MUESTRAS.png(), 'a.png'),
        401,
        'NO_AUTENTICADO',
      );
      esperarError(
        await ctx.http().post('/archivos').set(conSesion(token)).attach('archivo', MUESTRAS.texto(), 'a.jpg'),
        415,
        'TIPO_DE_ARCHIVO_NO_PERMITIDO',
      );
    });

    it('la subida es idéntica en forma: { url, tipo, bytes } y clave del servidor', async () => {
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .attach('archivo', MUESTRAS.png(300), 'mi foto.png')
        .expect(201);
      esperarContrato(res.body, 'ArchivoSubido');
      expect(res.body.datos.bytes).toBe(300);
      expect(claveDe(res.body.datos.url)).toMatch(/^imagenes\/\d{4}\/\d{2}\/[a-z0-9]{12}\.png$/);
    });
  });
}

pruebasDeArchivos('disco (local)', () => undefined, 'local');
if (hayS3) pruebasDeArchivos('S3Proxy', () => entornoS3Prueba('verif-m6'), 's3proxy');

describe('M6 / AGENTS §18.2 — URLs https con CONFIAR_PROXY', () => {
  it('las imágenes de un lugar y la foto subida salen https con X-Forwarded-*', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const { token } = await registrarTurista(ctx);
      const subida = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.onrender.com')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      const url = subida.body.datos.url as string;
      expect(url).toMatch(/^https:\/\/api\.onrender\.com\/archivos\/imagenes\//);
      const id = await crearLugar(ctx, { imagenes: [claveDe(url)] });
      const lugar = await ctx
        .http()
        .get(`/lugares/${id}`)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.onrender.com')
        .expect(200);
      esperarContrato(lugar.body, 'Lugar');
      expect(lugar.body.datos.imagenes).toEqual([url]);
      const lista = await ctx
        .http()
        .get('/lugares')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'api.onrender.com')
        .expect(200);
      esperarContrato(lista.body, 'Lugar');
      for (const l of lista.body.datos) for (const i of l.imagenes) expect(i).toMatch(/^https:\/\//);
      // el archivo se baja con la ruta de esa URL
      await ctx.http().get(new URL(url).pathname).expect(200);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sólo X-Forwarded-Proto (sin Host): https con el Host del pedido', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('Host', 'mi-api.koyeb.app')
        .set('X-Forwarded-Proto', 'https')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      expect(res.body.datos.url).toMatch(/^https:\/\/mi-api\.koyeb\.app\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('cadena de proxies "https, http": toma https y una sola vez el host', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('X-Forwarded-Proto', 'https, http')
        .set('X-Forwarded-Host', 'api.ejemplo.com')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      expect(res.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.com\/archivos\/imagenes\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('URL_PUBLICA gana sobre X-Forwarded-* aun con CONFIAR_PROXY', async () => {
    const ctx = await crearApp({
      entorno: { CONFIAR_PROXY: 'true', URL_PUBLICA: 'https://oficial.ejemplo.com' },
    });
    try {
      const { token } = await registrarTurista(ctx);
      const res = await ctx
        .http()
        .post('/archivos')
        .set(conSesion(token))
        .set('X-Forwarded-Host', 'otro.com')
        .set('X-Forwarded-Proto', 'http')
        .attach('archivo', MUESTRAS.png(), 'a.png')
        .expect(201);
      expect(res.body.datos.url).toMatch(/^https:\/\/oficial\.ejemplo\.com\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin CONFIAR_PROXY, un cliente no puede forzar https ni otro host en las imágenes de un lugar', async () => {
    const ctx = await crearApp();
    try {
      const { token } = await registrarTurista(ctx);
      const url = await subirArchivo(ctx, token);
      const id = await crearLugar(ctx, { imagenes: [claveDe(url)] });
      const res = await ctx
        .http()
        .get(`/lugares/${id}`)
        .set('Host', '10.0.0.7:3000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'trucho.com')
        .expect(200);
      expect(res.body.datos.imagenes[0]).toMatch(/^http:\/\/10\.0\.0\.7:3000\/archivos\/imagenes\//);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('M6 / AGENTS §18.2 — ENTORNO=publicado: condiciones que impiden arrancar', () => {
  const valido = {
    ENTORNO: 'publicado',
    JWT_SECRETO: 'x'.repeat(40),
    ARCHIVOS_PROVEEDOR: 's3proxy',
    S3_ENDPOINT: 'http://127.0.0.1:1',
    S3_BUCKET: 'b',
    DB_MOTOR: 'postgres',
    DB_URL: 'postgres://api:api@127.0.0.1:1/api',
    SIMULACION_HABILITADA: 'false',
  };
  const PROHIBIDAS_EN_MENSAJE = /Exception|undefined|\bnull\b|stack|Cannot |ZodError|ValidationError/;

  const debeFallar = async (entorno: Record<string, string>, quedeDicho: RegExp) => {
    const error = await crearApp({ entorno }).then(
      async (c) => {
        await c.cerrar();
        return null;
      },
      (e: unknown) => e as Error,
    );
    expect(error, 'la app arrancó y no debía').not.toBeNull();
    expect(error!.message).toMatch(quedeDicho);
    expect(error!.message).not.toMatch(PROHIBIDAS_EN_MENSAJE);
  };

  it('SQLite: el disco del host se borra en cada reinicio', async () => {
    await debeFallar({ ...valido, DB_MOTOR: 'better-sqlite3', DB_ARCHIVO: ':memory:' }, /SQLite|DB_MOTOR/i);
  });

  it('archivos en disco (local)', async () => {
    await debeFallar({ ...valido, ARCHIVOS_PROVEEDOR: 'local' }, /ARCHIVOS_PROVEEDOR|local|disco/i);
  });

  it('archivos sin ARCHIVOS_PROVEEDOR (default local)', async () => {
    const { ARCHIVOS_PROVEEDOR: _omitido, ...sin } = valido;
    await debeFallar({ ...sin, ARCHIVOS_PROVEEDOR: '' }, /ARCHIVOS_PROVEEDOR|local|disco/i);
  });

  it('JWT_SECRETO de desarrollo', async () => {
    await debeFallar({ ...valido, JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion' }, /JWT_SECRETO/);
  });

  it('JWT_SECRETO de 31 caracteres (el mínimo es 32)', async () => {
    await debeFallar({ ...valido, JWT_SECRETO: 'y'.repeat(31) }, /JWT_SECRETO/);
  });

  it('SIMULACION_HABILITADA=true', async () => {
    await debeFallar({ ...valido, SIMULACION_HABILITADA: 'true' }, /SIMULACION_HABILITADA/);
  });

  it('un JWT_SECRETO de 32 caracteres exactos no es el motivo del rechazo', async () => {
    // Arranca o falla por otra causa (la base/almacén de mentira), pero nunca por el secreto.
    const error = await crearApp({ entorno: { ...valido, JWT_SECRETO: 'z'.repeat(32) } }).then(
      async (c) => {
        await c.cerrar();
        return null;
      },
      (e: unknown) => e as Error,
    );
    if (error) expect(error.message).not.toMatch(/JWT_SECRETO/);
  });

  it('con todo en regla y ENTORNO=test-like, el mismo entorno mínimo sí arranca (control)', async () => {
    const ctx = await crearApp();
    try {
      await ctx.http().get('/salud').expect(200);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe.runIf(hayS3 && process.env.DB_MOTOR === 'postgres')(
  'M6 — publicado con Postgres + S3Proxy arranca y avisa "publicado"',
  () => {
    it('arranca con todo en regla', async () => {
      const ctx = await crearApp({
        entorno: {
          ...entornoS3Prueba('verif-publicado'),
          ENTORNO: 'publicado',
          JWT_SECRETO: 'k'.repeat(40),
          CONFIAR_PROXY: 'true',
        },
      });
      try {
        const res = await ctx.http().get('/salud').expect(200);
        expect(res.body.datos.motor).toBe('postgres');
        expect(res.body.datos.almacen).toBe('s3proxy');
        const { token } = await registrarTurista(ctx);
        const r = await ctx
          .http()
          .post('/archivos')
          .set(conSesion(token))
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-Host', 'api.onrender.com')
          .attach('archivo', MUESTRAS.png(), 'a.png')
          .expect(201);
        expect(r.body.datos.url).toMatch(/^https:\/\//);
        // simulación desactivada: la cabecera no hace nada
        await ctx.http().get('/salud').set('X-Simular', 'error-500').expect(200);
      } finally {
        await ctx.cerrar();
      }
    });
  },
);

describe('M6 / AGENTS §4.6 y §17.1 — ALMACEN_NO_DISPONIBLE (503) con un almacén que se cae', () => {
  let falso: Server;
  let caido = false;
  let ctx: AppDePrueba;
  let token: string;
  let ruta: string;
  const objetos = new Map<string, Buffer>();

  beforeAll(async () => {
    // S3 de mentira: mientras anda, guarda y devuelve objetos; cuando se "cae", corta las conexiones.
    falso = createServer((req, res) => {
      if (caido) {
        req.socket.destroy();
        return;
      }
      const clave = decodeURIComponent((req.url ?? '/').split('?')[0]!);
      const partes: Buffer[] = [];
      req.on('data', (d: Buffer) => partes.push(d));
      req.on('end', () => {
        const ruta = clave.replace(/^\/[^/]+\/?/, '');
        if (!ruta) {
          res.writeHead(200).end();
          return;
        }
        if (req.method === 'PUT') {
          objetos.set(ruta, Buffer.concat(partes));
          res.writeHead(200, { ETag: '"x"' }).end();
        } else if (objetos.has(ruta)) {
          const cuerpo = objetos.get(ruta)!;
          res.writeHead(200, { 'Content-Length': cuerpo.length, 'Content-Type': 'image/png', ETag: '"x"' });
          res.end(req.method === 'HEAD' ? undefined : cuerpo);
        } else {
          res
            .writeHead(404, { 'Content-Type': 'application/xml' })
            .end('<Error><Code>NoSuchKey</Code></Error>');
        }
      });
    });
    await new Promise<void>((r) => falso.listen(0, '127.0.0.1', r));
    const puerto = (falso.address() as AddressInfo).port;
    ctx = await crearApp({
      entorno: {
        ARCHIVOS_PROVEEDOR: 's3proxy',
        S3_ENDPOINT: `http://127.0.0.1:${puerto}`,
        S3_BUCKET: 'falso',
        ARCHIVOS_CREAR_BUCKET: 'false',
      },
    });
    ({ token } = await registrarTurista(ctx));
    ruta = new URL(await subirArchivo(ctx, token)).pathname;
  });
  afterAll(async () => {
    await ctx.cerrar();
    falso.closeAllConnections();
    await new Promise((r) => falso.close(r));
  });

  it('mientras anda, baja el archivo', async () => {
    await ctx.http().get(ruta).expect(200);
  });

  it('GET /archivos/<clave> con el almacén caído → 503 ALMACEN_NO_DISPONIBLE', async () => {
    caido = true;
    const res = await ctx.http().get(ruta);
    esperarError(res, 503, 'ALMACEN_NO_DISPONIBLE');
    expect(res.body.error.mensaje).toMatch(/archivos/i);
  }, 60_000);

  it('POST /archivos con el almacén caído → 503 ALMACEN_NO_DISPONIBLE', async () => {
    const res = await ctx
      .http()
      .post('/archivos')
      .set(conSesion(token))
      .attach('archivo', MUESTRAS.png(), 'a.png');
    esperarError(res, 503, 'ALMACEN_NO_DISPONIBLE');
  }, 60_000);

  it('el resto de la API sigue andando con el almacén caído', async () => {
    const cat = await crearCategoria(ctx);
    const id = await crearLugar(ctx, { categoriaId: cat.id });
    const res = await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarContrato(res.body, 'Lugar');
    await ctx.http().get('/salud').expect(200);
  });
});

describe('M6 — el contrato de los demás módulos no cambió con el puerto nuevo', () => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp();
    ({ token } = await registrarTurista(ctx));
  });
  afterAll(() => ctx.cerrar());

  it('lugares con imagen, categorías y /yo pasan por esperarContrato', async () => {
    const url = await subirArchivo(ctx, token);
    const cat = await crearCategoria(ctx);
    const id = await crearLugar(ctx, {
      categoriaId: cat.id,
      imagenes: [claveDe(url)],
      telefono: '3447-421234',
      sitioWeb: 'https://ejemplo.com',
      precioEntrada: 0,
    });
    const lugar = await ctx.http().get(`/lugares/${id}`).expect(200);
    esperarContrato(lugar.body, 'Lugar');
    expect(lugar.body.datos.imagenes[0]).toBe(url);
    const vacio = await crearLugar(ctx, { categoriaId: cat.id });
    esperarContrato(
      await ctx
        .http()
        .get(`/lugares/${vacio}`)
        .expect(200)
        .then((r) => r.body),
      'Lugar',
    );
    esperarContrato((await ctx.http().get('/lugares').expect(200)).body, 'Lugar');
    esperarContrato((await ctx.http().get('/categorias').expect(200)).body, 'Categoria');
    const yo = await ctx.http().get('/yo').set(conSesion(token)).expect(200);
    esperarContrato(yo.body, 'Usuario');
  });

  it('visita con foto subida: 201 y forma exacta; y la foto se baja', async () => {
    const foto = await subirArchivo(ctx, token);
    const lugarId = await crearLugar(ctx);
    const res = await ctx
      .http()
      .post('/yo/visitas')
      .set(conSesion(token))
      .send({ lugarId, fechaHora: '2026-11-14T10:00:00-03:00', origen: 'manual', fotoUri: foto, nota: null })
      .expect(201);
    esperarContrato(res.body, 'Visita');
    expect(res.body.datos.fotoUri).toBe(foto);
    await ctx.http().get(new URL(foto).pathname).expect(200);
  });

  it('un file:// o una URL ajena sigue siendo ARCHIVO_NO_SUBIDO', async () => {
    const lugarId = await crearLugar(ctx);
    for (const fotoUri of [
      'file:///tmp/a.jpg',
      'https://otro.com/archivos/imagenes/2026/11/aaaaaaaaaaaa.png',
    ]) {
      const res = await ctx
        .http()
        .post('/yo/visitas')
        .set(conSesion(token))
        .send({ lugarId, fechaHora: '2026-11-14T10:00:00-03:00', origen: 'manual', fotoUri });
      esperarError(res, 422, 'ARCHIVO_NO_SUBIDO');
    }
  });

  it('rutas inexistentes y 401 siguen con sobre de error exacto', async () => {
    esperarError(await ctx.http().get('/no-existe'), 404, 'RUTA_NO_ENCONTRADA');
    esperarError(await ctx.http().get('/yo'), 401, 'NO_AUTENTICADO');
  });
});
