import type { Response } from 'supertest';
import { ArchivosServicio } from '../../src/common/files/files.service.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { jpeg, m4a, mp3, mp4, png } from '../utilities/files.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario, type UsuarioDePrueba } from '../utilities/users.js';

const MB = 1024 * 1024;

function binario(respuesta: Response, listo: (error: Error | null, cuerpo: Buffer) => void) {
  const partes: Buffer[] = [];
  respuesta.on('data', (parte: Buffer) => partes.push(parte));
  respuesta.on('end', () => listo(null, Buffer.concat(partes)));
}

describe('AGENTS §8 — archivos', () => {
  let ctx: AppDePrueba;
  let u: UsuarioDePrueba;

  beforeAll(async () => {
    ctx = await crearApp();
    u = await crearUsuario(ctx);
  });
  afterAll(() => ctx.cerrar());

  const subir = (contenido: Buffer, nombre = 'archivo.bin', host?: string) => {
    const pedido = ctx.http.post('/archivos').set(u.auth);
    if (host) pedido.set('Host', host);
    return pedido.attach('archivo', contenido, nombre);
  };
  const rutaDe = (url: string) => new URL(url).pathname;

  describe('POST /archivos', () => {
    it.each([
      ['jpeg', jpeg(), 'imagen', /\/archivos\/imagenes\/\d{4}\/\d{2}\/[a-z0-9]+\.jpg$/],
      ['png', png(), 'imagen', /\/archivos\/imagenes\/.+\.png$/],
      ['mp3', mp3(), 'audio', /\/archivos\/audios\/.+\.mp3$/],
      ['m4a', m4a(), 'audio', /\/archivos\/audios\/.+\.m4a$/],
      ['mp4', mp4(), 'video', /\/archivos\/videos\/.+\.mp4$/],
    ])('sube un %s → 201 { url, tipo, bytes }', async (_nombre, contenido, tipo, forma) => {
      const r = await subir(contenido).expect(201);
      esperarContrato(r.body, 'ArchivoSubido');
      expect(r.body.datos.tipo).toBe(tipo);
      expect(r.body.datos.bytes).toBe(contenido.length);
      expect(r.body.datos.url).toMatch(forma);
    });

    it('la clave la genera el servidor: el nombre que manda el usuario no aparece', async () => {
      const r = await subir(jpeg(), '../../../etc/mi-foto-secreta.jpg').expect(201);
      expect(r.body.datos.url).not.toContain('secreta');
      expect(r.body.datos.url).not.toContain('..');
    });

    it('la clave usa el mes de Buenos Aires', async () => {
      const antes = ctx.reloj.ahora();
      ctx.reloj.fijar('2026-09-30T23:30:00-03:00'); // ya es 1/10 en UTC
      try {
        const r = await subir(jpeg()).expect(201);
        expect(r.body.datos.url).toContain('/imagenes/2026/09/');
      } finally {
        ctx.reloj.fijar(antes);
      }
    });

    it('AGENTS §8 — la URL es absoluta con el Host del pedido', async () => {
      const r = await subir(jpeg(), 'x.jpg', '10.0.0.5:3000').expect(201);
      expect(r.body.datos.url).toMatch(/^http:\/\/10\.0\.0\.5:3000\/archivos\/imagenes\//);
    });

    it('se mira la firma, no la extensión: un texto con nombre .jpg → 415', async () => {
      const r = await subir(Buffer.from('esto no es una foto, es texto plano'), 'foto.jpg');
      esperarError(r, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    });

    it('un GIF (formato no permitido) → 415 TIPO_DE_ARCHIVO_NO_PERMITIDO', async () => {
      const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(100)]);
      esperarError(await subir(gif, 'a.gif'), 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
    });

    it('una imagen de más de 5 MB → 413 ARCHIVO_DEMASIADO_GRANDE', async () => {
      const r = await subir(jpeg(5 * MB + 1), 'grande.jpg');
      esperarError(r, 413, 'ARCHIVO_DEMASIADO_GRANDE');
      expect(r.body.error.mensaje).toMatch(/5 MB/);
    });

    it('una imagen de 5 MB justos entra', async () => {
      await subir(jpeg(5 * MB), 'justa.jpg').expect(201);
    });

    it('un audio de más de 10 MB → 413', async () => {
      esperarError(await subir(mp3(10 * MB + 1), 'a.mp3'), 413, 'ARCHIVO_DEMASIADO_GRANDE');
    });

    it('un video de más de 30 MB → 413 (lo corta la subida)', async () => {
      esperarError(await subir(mp4(30 * MB + 1), 'v.mp4'), 413, 'ARCHIVO_DEMASIADO_GRANDE');
    });

    it('sin el campo archivo → 400 VALIDACION_FALLIDA', async () => {
      const r = await ctx.http.post('/archivos').set(u.auth).field('otra', 'cosa');
      esperarError(r, 400, 'VALIDACION_FALLIDA');
      expect(r.body.error.mensaje).toMatch(/Falta el archivo/);
    });

    it('con el archivo en otro campo → 400 VALIDACION_FALLIDA', async () => {
      const r = await ctx.http.post('/archivos').set(u.auth).attach('foto', jpeg(), 'a.jpg');
      esperarError(r, 400, 'VALIDACION_FALLIDA');
    });

    it('sin sesión → 401 NO_AUTENTICADO', async () => {
      esperarError(
        await ctx.http.post('/archivos').attach('archivo', jpeg(), 'a.jpg'),
        401,
        'NO_AUTENTICADO',
      );
    });
  });

  describe('GET /archivos/<clave>', () => {
    let url: string;
    const contenido = mp4(1000);

    beforeAll(async () => {
      url = (await subir(contenido, 'video.mp4')).body.datos.url as string;
    });

    it('baja los mismos bytes, con tipo, largo y caché', async () => {
      const r = await ctx.http.get(rutaDe(url)).buffer(true).parse(binario).expect(200);
      expect((r.body as Buffer).equals(contenido)).toBe(true);
      expect(r.headers['content-type']).toBe('video/mp4');
      expect(r.headers['content-length']).toBe('1000');
      expect(r.headers['accept-ranges']).toBe('bytes');
      expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(r.headers.etag).toMatch(/^".+"$/);
    });

    it('es público: no pide sesión', async () => {
      await ctx.http.get(rutaDe(url)).expect(200);
    });

    it('AGENTS §8 — un rango devuelve 206 con Content-Range y esos bytes', async () => {
      const r = await ctx.http
        .get(rutaDe(url))
        .set('Range', 'bytes=10-19')
        .buffer(true)
        .parse(binario)
        .expect(206);
      expect(r.headers['content-range']).toBe('bytes 10-19/1000');
      expect(r.headers['content-length']).toBe('10');
      expect((r.body as Buffer).equals(contenido.subarray(10, 20))).toBe(true);
    });

    it('el final del archivo con "bytes=-5"', async () => {
      const r = await ctx.http
        .get(rutaDe(url))
        .set('Range', 'bytes=-5')
        .buffer(true)
        .parse(binario)
        .expect(206);
      expect(r.headers['content-range']).toBe('bytes 995-999/1000');
      expect((r.body as Buffer).equals(contenido.subarray(995))).toBe(true);
    });

    it('un rango fuera del archivo → 416 RANGO_NO_VALIDO', async () => {
      const r = await ctx.http.get(rutaDe(url)).set('Range', 'bytes=5000-6000');
      esperarError(r, 416, 'RANGO_NO_VALIDO');
      expect(r.headers['content-range']).toBe('bytes */1000');
    });

    it.each([['items=0-5'], ['bytes=abc'], ['bytes=20-10'], ['bytes=0-1,5-6']])(
      'RFC 9110 §14.2 — un Range que no se entiende (%s) se ignora: 200 con el archivo entero',
      async (rango) => {
        const r = await ctx.http.get(rutaDe(url)).set('Range', rango).buffer(true).parse(binario);
        expect(r.status).toBe(200);
        expect((r.body as Buffer).equals(contenido)).toBe(true);
      },
    );

    it('una clave que no existe → 404 ARCHIVO_NO_ENCONTRADO', async () => {
      esperarError(
        await ctx.http.get('/archivos/imagenes/2026/09/noexisteningunarchivoasi.jpg'),
        404,
        'ARCHIVO_NO_ENCONTRADO',
      );
    });

    it.each([
      ['/archivos/..%2F..%2Fpackage.json'],
      ['/archivos/imagenes/../../package.json'],
      ['/archivos/package.json'],
      ['/archivos/imagenes/2026/09/ABC.jpg'],
    ])('una clave inválida (%s) → 404, sin salir de la carpeta', async (ruta) => {
      const r = await ctx.http.get(ruta);
      expect(r.status).toBe(404);
      expect(JSON.stringify(r.body)).not.toContain('api-transporte-publico');
    });

    it('ARCHIVO_NO_SUBIDO se decide en cada módulo: claveSubida reconoce las URLs propias', async () => {
      const archivos = ctx.app.get(ArchivosServicio);
      const foto = (await subir(jpeg(), 'f.jpg')).body.datos.url as string;
      expect(await archivos.claveSubida(foto, 'imagen')).toMatch(/^imagenes\//);
      expect(await archivos.claveSubida(foto, 'video')).toBeNull();
      expect(await archivos.claveSubida(url, 'video')).toMatch(/^videos\//);
      expect(await archivos.claveSubida('https://otro.sitio/v.mp4', 'video')).toBeNull();
      expect(await archivos.claveSubida('file:///sdcard/foto.jpg', 'imagen')).toBeNull();
      expect(
        await archivos.claveSubida(
          'http://localhost:3000/archivos/imagenes/2026/09/noexisteningunarchivoasi.jpg',
          'imagen',
        ),
      ).toBeNull();
    });
  });
});

describe('AGENTS §8 y §18.2 — de dónde sale el origen de las URLs', () => {
  it('URL_PUBLICA manda sobre el Host del pedido', async () => {
    const ctx = await crearApp({ entorno: { URL_PUBLICA: 'https://api.ejemplo.ar' } });
    try {
      const u = await crearUsuario(ctx);
      const r = await ctx.http
        .post('/archivos')
        .set(u.auth)
        .set('Host', '10.0.0.5:3000')
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(/^https:\/\/api\.ejemplo\.ar\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('CONFIAR_PROXY=true: usa X-Forwarded-Proto y X-Forwarded-Host (URLs https)', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const u = await crearUsuario(ctx);
      const r = await ctx.http
        .post('/archivos')
        .set(u.auth)
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'mi-api.onrender.com')
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(/^https:\/\/mi-api\.onrender\.com\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin CONFIAR_PROXY, las cabeceras X-Forwarded-* se ignoran', async () => {
    const ctx = await crearApp();
    try {
      const u = await crearUsuario(ctx);
      const r = await ctx.http
        .post('/archivos')
        .set(u.auth)
        .set('Host', '192.168.0.10:3000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'trucho.com')
        .attach('archivo', jpeg(), 'a.jpg')
        .expect(201);
      expect(r.body.datos.url).toMatch(/^http:\/\/192\.168\.0\.10:3000\/archivos\//);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('AGENTS §17.1 — el almacén no responde', () => {
  it('503 ALMACEN_NO_DISPONIBLE al subir y al bajar', async () => {
    const { mkdtemp, rm, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directorio = await mkdtemp(join(tmpdir(), 'almacen-roto-'));
    const ctx = await crearApp({ entorno: { DIRECTORIO_ARCHIVOS: directorio } });
    try {
      const u = await crearUsuario(ctx);
      const subida = await ctx.http
        .post('/archivos')
        .set(u.auth)
        .attach('archivo', jpeg(), 'a.jpg');
      const ruta = new URL(subida.body.datos.url as string).pathname;
      // La carpeta desaparece y en su lugar queda un archivo: el disco "no responde".
      await rm(directorio, { recursive: true });
      await writeFile(directorio, 'no soy una carpeta');
      esperarError(
        await ctx.http.post('/archivos').set(u.auth).attach('archivo', jpeg(), 'b.jpg'),
        503,
        'ALMACEN_NO_DISPONIBLE',
      );
      esperarError(await ctx.http.get(ruta), 503, 'ALMACEN_NO_DISPONIBLE');
    } finally {
      await ctx.cerrar();
    }
  });

  it('si la carpeta de archivos no se puede usar, la API no arranca y dice qué revisar', async () => {
    const { mkdtemp, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const archivo = join(await mkdtemp(join(tmpdir(), 'almacen-')), 'soy-un-archivo');
    await writeFile(archivo, 'x');
    await expect(crearApp({ entorno: { DIRECTORIO_ARCHIVOS: archivo } })).rejects.toThrow(
      /DIRECTORIO_ARCHIVOS/,
    );
  });
});
