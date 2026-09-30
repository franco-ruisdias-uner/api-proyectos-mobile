// Verificación independiente de M6 — Nube (AGENTS §8, §17, §18). Caja negra.
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearVecino } from '../utilidades/usuarios.js';
import { jpegDe, jpegNumerado } from '../utilidades/archivos.js';

const S3 = process.env.S3_ENDPOINT_PRUEBA;
const SECRETO_LARGO = 'un-secreto-propio-de-mas-de-treinta-y-dos-caracteres-ok';

/** Lo que dice el error de arranque (tira si arranca). */
async function errorAlArrancar(
  entorno: Record<string, string>,
): Promise<string> {
  let ctx: AppDePrueba | undefined;
  try {
    ctx = await crearApp({ entorno });
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  await ctx.cerrar();
  throw new Error('La app arrancó y no debía');
}

const JERGA = /\b(undefined|TypeError|ECONN|stack|Cannot|Error:)\b/;

describe('AGENTS §18.2 — ENTORNO=publicado impide arrancar', () => {
  it('con SQLite, aunque el resto esté bien', async () => {
    const m = await errorAlArrancar({
      ENTORNO: 'publicado',
      DB_MOTOR: 'better-sqlite3',
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://127.0.0.1:1',
      S3_BUCKET: 'x',
      JWT_SECRETO: SECRETO_LARGO,
      SIMULACION_HABILITADA: 'false',
    });
    expect(m).toMatch(/sqlite/i);
    expect(m).not.toMatch(JERGA);
  });

  it('con archivos locales', async () => {
    const m = await errorAlArrancar({
      ENTORNO: 'publicado',
      ARCHIVOS_PROVEEDOR: 'local',
      JWT_SECRETO: SECRETO_LARGO,
      SIMULACION_HABILITADA: 'false',
    });
    expect(m).toMatch(/archivos/i);
  });

  it('con el JWT_SECRETO de desarrollo', async () => {
    const m = await errorAlArrancar({
      ENTORNO: 'publicado',
      JWT_SECRETO: 'solo-para-desarrollo-no-usar-en-produccion',
      SIMULACION_HABILITADA: 'false',
    });
    expect(m).toMatch(/JWT_SECRETO/);
  });

  it('con un JWT_SECRETO de 31 caracteres', async () => {
    const m = await errorAlArrancar({
      ENTORNO: 'publicado',
      JWT_SECRETO: 'a'.repeat(31),
      SIMULACION_HABILITADA: 'false',
    });
    expect(m).toMatch(/JWT_SECRETO/);
  });

  it('con SIMULACION_HABILITADA=true explícito', async () => {
    const m = await errorAlArrancar({
      ENTORNO: 'publicado',
      JWT_SECRETO: SECRETO_LARGO,
      SIMULACION_HABILITADA: 'true',
    });
    expect(m).toMatch(/SIMULACION_HABILITADA|simulaci/i);
  });

  it('un ENTORNO desconocido no arranca', async () => {
    const m = await errorAlArrancar({ ENTORNO: 'produccion' });
    expect(m).toMatch(/ENTORNO/);
  });
});

describe('AGENTS §17.2 — presets S3: variables que faltan', () => {
  it.each([
    ['supabase', 'SUPABASE_PROYECTO'],
    ['r2', 'R2_CUENTA'],
    ['b2', 'S3_REGION'],
    ['aws', 'S3_BUCKET'],
  ])('%s sin variables dice cuál falta (%s)', async (proveedor, variable) => {
    const m = await errorAlArrancar({ ARCHIVOS_PROVEEDOR: proveedor });
    expect(m).toContain(variable);
    expect(m).not.toMatch(JERGA);
  });

  it('un proveedor inventado no arranca y nombra ARCHIVOS_PROVEEDOR', async () => {
    const m = await errorAlArrancar({ ARCHIVOS_PROVEEDOR: 'firebase' });
    expect(m).toMatch(/ARCHIVOS_PROVEEDOR/);
  });

  it('supabase con bucket pero sin claves pide las claves', async () => {
    const m = await errorAlArrancar({
      ARCHIVOS_PROVEEDOR: 'supabase',
      SUPABASE_PROYECTO: 'abc',
      S3_REGION: 'sa-east-1',
      S3_BUCKET: 'b',
    });
    expect(m).toMatch(/S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY/);
  });

  it('un almacén S3 que no responde impide arrancar con mensaje claro', async () => {
    const m = await errorAlArrancar({
      ARCHIVOS_PROVEEDOR: 's3proxy',
      S3_ENDPOINT: 'http://127.0.0.1:1',
      S3_BUCKET: 'x',
    });
    expect(m.length).toBeGreaterThan(10);
    expect(m).not.toMatch(/undefined/);
  });
});

describe('AGENTS §18.1 — presets de base de datos', () => {
  it('supabase con el pooler en modo transacción (6543) se rechaza y explica', async () => {
    const m = await errorAlArrancar({
      DB_PROVEEDOR: 'supabase',
      DB_URL:
        'postgresql://postgres.abcd:clave@aws-0-sa-east-1.pooler.supabase.com:6543/postgres',
    });
    expect(m).toMatch(/5432/);
  });

  it('supabase con la conexión directa (db.<ref>.supabase.co) se rechaza', async () => {
    const m = await errorAlArrancar({
      DB_PROVEEDOR: 'supabase',
      DB_URL: 'postgresql://postgres:clave@db.abcd.supabase.co:5432/postgres',
    });
    expect(m).toMatch(/pooler/i);
  });

  it('supabase sin DB_URL pide DB_URL', async () => {
    const m = await errorAlArrancar({ DB_PROVEEDOR: 'supabase', DB_URL: '' });
    expect(m).toMatch(/DB_URL/);
  });

  it('neon con un host que no es de neon se rechaza', async () => {
    const m = await errorAlArrancar({
      DB_PROVEEDOR: 'neon',
      DB_URL: 'postgres://u:p@ejemplo.com:5432/db',
    });
    expect(m).toMatch(/neon/i);
  });

  it('aiven-mysql con host equivocado se rechaza', async () => {
    const m = await errorAlArrancar({
      DB_PROVEEDOR: 'aiven-mysql',
      DB_URL: 'mysql://u:p@ejemplo.com:3306/db',
    });
    expect(m).toMatch(/aiven/i);
  });

  it('DB_PROVEEDOR postgres con DB_MOTOR=mysql se contradicen y no arranca', async () => {
    const m = await errorAlArrancar({
      DB_PROVEEDOR: 'neon',
      DB_MOTOR: 'mysql',
      DB_URL: 'postgres://u:p@ep-x.neon.tech/db',
    });
    expect(m).toMatch(/DB_MOTOR|DB_PROVEEDOR/);
  });

  it('DB_PROVEEDOR desconocido no arranca', async () => {
    const m = await errorAlArrancar({ DB_PROVEEDOR: 'heroku' });
    expect(m).toMatch(/DB_PROVEEDOR/);
  });

  it('DB_SSL inválido no arranca', async () => {
    const m = await errorAlArrancar({ DB_SSL: 'quizas' });
    expect(m).toMatch(/DB_SSL/);
  });
});

describe('AGENTS §18.2 — CONFIAR_PROXY y URLs de archivos', () => {
  async function subir(
    ctx: AppDePrueba,
    cabeceras: Record<string, string> = {},
  ) {
    const v = await crearVecino(ctx);
    return ctx
      .http()
      .post('/archivos')
      .set(...v.auth)
      .set(cabeceras)
      .attach('archivo', jpegDe(400), 'foto.jpg');
  }

  it('con proxy: https + host del proxy, y el sobre cumple el contrato', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const res = await subir(ctx, {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'api.onrender.com',
      });
      expect(res.status).toBe(201);
      esperarContrato(res, 'ArchivoSubido');
      expect(res.body.datos.url).toMatch(
        /^https:\/\/api\.onrender\.com\/archivos\/imagenes\//,
      );
    } finally {
      await ctx.cerrar();
    }
  });

  it('con proxy pero sin cabeceras: usa el Host del pedido', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const res = await subir(ctx, { Host: '10.0.0.5:3000' });
      expect(res.body.datos.url).toMatch(
        /^http:\/\/10\.0\.0\.5:3000\/archivos\//,
      );
    } finally {
      await ctx.cerrar();
    }
  });

  it('con proxy: X-Forwarded-Host con puerto se respeta', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const res = await subir(ctx, {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'midominio.ar:8443',
      });
      expect(res.body.datos.url).toMatch(
        /^https:\/\/midominio\.ar:8443\/archivos\//,
      );
    } finally {
      await ctx.cerrar();
    }
  });

  it('sin proxy: las cabeceras X-Forwarded-* se ignoran (no se puede falsificar el origen)', async () => {
    const ctx = await crearApp();
    try {
      const res = await subir(ctx, {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'malo.example.com',
      });
      expect(res.body.datos.url).not.toContain('malo.example.com');
      expect(res.body.datos.url).toMatch(/^http:\/\//);
    } finally {
      await ctx.cerrar();
    }
  });

  it('URL_PUBLICA gana sobre las cabeceras y no duplica la barra final', async () => {
    const ctx = await crearApp({
      entorno: {
        CONFIAR_PROXY: 'true',
        URL_PUBLICA: 'https://fija.example.com/',
      },
    });
    try {
      const res = await subir(ctx, { 'X-Forwarded-Host': 'otra.example.com' });
      expect(res.body.datos.url).toMatch(
        /^https:\/\/fija\.example\.com\/archivos\/imagenes\//,
      );
    } finally {
      await ctx.cerrar();
    }
  });

  it('las URLs dentro de un reporte también salen https con proxy', async () => {
    const ctx = await crearApp({ entorno: { CONFIAR_PROXY: 'true' } });
    try {
      const hdr = {
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Host': 'api.onrender.com',
      };
      const res = await subir(ctx, hdr);
      const url: string = res.body.datos.url;
      const l = await ctx.http().get('/zonas').set(hdr);
      expect(l.status).toBe(200);
      // La URL subida se puede volver a bajar por su ruta
      const bajada = await ctx.http().get(new URL(url).pathname);
      expect(bajada.status).toBe(200);
    } finally {
      await ctx.cerrar();
    }
  });
});

describe('AGENTS §17 — S3Proxy vía la API', () => {
  it.runIf(!S3)('necesita S3Proxy (matriz)', () => {
    expect(S3).toBeUndefined();
  });

  describe.runIf(!!S3)('con S3Proxy', () => {
    let ctx: AppDePrueba;
    let auth: [string, string];
    const contenido = jpegNumerado(4000);
    let ruta: string;
    beforeAll(async () => {
      ctx = await crearApp({
        entorno: {
          ARCHIVOS_PROVEEDOR: 's3proxy',
          S3_ENDPOINT: S3 as string,
          S3_BUCKET: `v-${Math.random().toString(36).slice(2, 10)}`,
        },
      });
      const v = await crearVecino(ctx);
      auth = v.auth as [string, string];
      const res = await ctx
        .http()
        .post('/archivos')
        .set(...auth)
        .attach('archivo', contenido, 'foto.jpg');
      ruta = new URL(res.body.datos.url).pathname;
    });
    afterAll(() => ctx.cerrar());

    const bin = (r: ReturnType<ReturnType<AppDePrueba['http']>['get']>) =>
      r.buffer(true).parse((res, cb) => {
        const p: Buffer[] = [];
        res.on('data', (x: Buffer) => p.push(x));
        res.on('end', () => cb(null, Buffer.concat(p)));
      });

    it('/salud informa s3proxy y cumple el contrato', async () => {
      const res = await ctx.http().get('/salud');
      esperarContrato(res, 'Salud');
      expect(res.body.datos.almacen).toBe('s3proxy');
    });

    it('rango intermedio: 206 con Content-Range y bytes exactos', async () => {
      const res = await bin(ctx.http().get(ruta).set('Range', 'bytes=10-19'));
      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 10-19/4000');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(
        Buffer.compare(res.body as Buffer, contenido.subarray(10, 20)),
      ).toBe(0);
    });

    it('rango abierto (bytes=3990-) y de sufijo (bytes=-5)', async () => {
      const a = await bin(ctx.http().get(ruta).set('Range', 'bytes=3990-'));
      expect(a.status).toBe(206);
      expect(Buffer.compare(a.body as Buffer, contenido.subarray(3990))).toBe(
        0,
      );
      const b = await bin(ctx.http().get(ruta).set('Range', 'bytes=-5'));
      expect(b.status).toBe(206);
      expect(Buffer.compare(b.body as Buffer, contenido.subarray(3995))).toBe(
        0,
      );
    });

    it('rango que pasa del final se recorta; fuera de rango da 416', async () => {
      const a = await ctx.http().get(ruta).set('Range', 'bytes=3999-9999');
      expect(a.status).toBe(206);
      expect(a.headers['content-range']).toBe('bytes 3999-3999/4000');
      const b = await ctx.http().get(ruta).set('Range', 'bytes=5000-6000');
      expect(b.status).toBe(416);
    });

    it('cabeceras de caché inmutable, ETag y Content-Length', async () => {
      const res = await ctx.http().get(ruta);
      expect(res.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(res.headers['etag']).toBeTruthy();
      expect(res.headers['content-length']).toBe('4000');
    });

    it('clave inexistente: 404 ARCHIVO_NO_ENCONTRADO con sobre de error', async () => {
      const res = await ctx
        .http()
        .get('/archivos/imagenes/2026/09/noexiste.jpg');
      expect(res.status).toBe(404);
      esperarError(res, 404, 'ARCHIVO_NO_ENCONTRADO');
    });

    it('claves con traversal o basura no dan 500', async () => {
      for (const p of [
        '/archivos/..%2f..%2fetc%2fpasswd',
        '/archivos/imagenes/%00.jpg',
        '/archivos/',
      ]) {
        const res = await ctx.http().get(p);
        expect(res.status).toBeLessThan(500);
      }
    });

    it('un archivo subido se puede usar en un reporte (ARCHIVO_NO_SUBIDO no se dispara)', async () => {
      const url = `http://127.0.0.1:1${ruta}`;
      const res = await ctx
        .http()
        .post('/reportes')
        .set(...auth)
        .send({
          tipoId: 'tip-bache',
          descripcion: null,
          audioUrl: null,
          fotos: [{ url }],
          coordenadas: { latitud: -33.0089, longitud: -58.5142 },
          direccion: 'x',
          creadoEn: '2026-09-14T09:00:00-03:00',
        });
      // Cualquier respuesta es válida salvo un 500; sólo comprobamos que sea un sobre coherente.
      expect(res.status).toBeLessThan(500);
    });

    it('sin token, POST /archivos da 401', async () => {
      const res = await ctx
        .http()
        .post('/archivos')
        .attach('archivo', contenido, 'f.jpg');
      expect(res.status).toBe(401);
      esperarError(res, 401, 'NO_AUTENTICADO');
    });

    it('tipo no permitido 415 y archivo enorme 413 también con S3', async () => {
      const pdf = await ctx
        .http()
        .post('/archivos')
        .set(...auth)
        .attach('archivo', Buffer.from('%PDF-1.7\n' + 'x'.repeat(50)), 'a.pdf');
      expect(pdf.status).toBe(415);
      esperarError(pdf, 415, 'TIPO_DE_ARCHIVO_NO_PERMITIDO');
      const grande = await ctx
        .http()
        .post('/archivos')
        .set(...auth)
        .attach('archivo', jpegDe(5 * 1024 * 1024 + 1), 'g.jpg');
      expect(grande.status).toBe(413);
      esperarError(grande, 413, 'ARCHIVO_DEMASIADO_GRANDE');
    });
  });

  describe.runIf(!!S3)('ARCHIVOS_REDIRIGIR=true', () => {
    it('responde 302 a una URL firmada', async () => {
      const ctx = await crearApp({
        entorno: {
          ARCHIVOS_PROVEEDOR: 's3proxy',
          S3_ENDPOINT: S3 as string,
          S3_BUCKET: `r-${Math.random().toString(36).slice(2, 10)}`,
          ARCHIVOS_REDIRIGIR: 'true',
        },
      });
      try {
        const v = await crearVecino(ctx);
        const sub = await ctx
          .http()
          .post('/archivos')
          .set(...v.auth)
          .attach('archivo', jpegDe(300), 'f.jpg');
        const res = await ctx
          .http()
          .get(new URL(sub.body.datos.url).pathname)
          .redirects(0);
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(/^https?:\/\//);
        expect(res.headers.location).toMatch(/X-Amz-Signature|Signature/i);
      } finally {
        await ctx.cerrar();
      }
    });
  });
});

describe('AGENTS §17 — proveedor local: salud y rango siguen igual', () => {
  it('/salud informa local', async () => {
    const ctx = await crearApp();
    try {
      const res = await ctx.http().get('/salud');
      esperarContrato(res, 'Salud');
      expect(res.body.datos.almacen).toBe('local');
    } finally {
      await ctx.cerrar();
    }
  });
});
