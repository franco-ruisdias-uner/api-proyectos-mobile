import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato } from '../utilidades/contrato.js';
import { crearVecino, type UsuarioDePrueba } from '../utilidades/usuarios.js';
import { jpegNumerado } from '../utilidades/archivos.js';

// Sólo corre en la matriz, con S3Proxy (S3_ENDPOINT_PRUEBA lo define scripts/matriz.mjs).
const endpoint = process.env.S3_ENDPOINT_PRUEBA;

const binario = (req: ReturnType<ReturnType<AppDePrueba['http']>['get']>) =>
  req.buffer(true).parse((res, cb) => {
    const partes: Buffer[] = [];
    res.on('data', (p: Buffer) => partes.push(p));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });

if (!endpoint) {
  describe('AGENTS §17.4 — Archivos con S3', () => {
    it('necesita S3Proxy: corre con pnpm test:e2e:matriz', () => {
      expect(endpoint).toBeUndefined();
    });
  });
} else {
  describe('AGENTS §17.4 — Archivos con S3 (S3Proxy)', () => {
    let ctx: AppDePrueba;
    let vecino: UsuarioDePrueba;
    beforeAll(async () => {
      ctx = await crearApp({
        entorno: {
          ARCHIVOS_PROVEEDOR: 's3proxy',
          S3_ENDPOINT: endpoint,
          S3_BUCKET: `api-${Math.random().toString(36).slice(2, 10)}`,
        },
      });
      vecino = await crearVecino(ctx);
    });
    afterAll(() => ctx.cerrar());

    const contenido = jpegNumerado(3000);

    it('/salud informa el proveedor', async () => {
      const res = await ctx.http().get('/salud');
      expect(res.body.datos.almacen).toBe('s3proxy');
    });

    it('sube con POST /archivos y baja con la URL devuelta (mismos bytes)', async () => {
      const subida = await ctx
        .http()
        .post('/archivos')
        .set(...vecino.auth)
        .attach('archivo', contenido, 'foto.jpg');
      expect(subida.status).toBe(201);
      esperarContrato(subida, 'ArchivoSubido');
      const bajada = await binario(
        ctx.http().get(new URL(subida.body.datos.url).pathname),
      );
      expect(bajada.status).toBe(200);
      expect(bajada.headers['content-type']).toBe('image/jpeg');
      expect(Buffer.compare(bajada.body as Buffer, contenido)).toBe(0);
    });

    it('un rango devuelve 206 con Content-Range', async () => {
      const subida = await ctx
        .http()
        .post('/archivos')
        .set(...vecino.auth)
        .attach('archivo', contenido, 'foto.jpg');
      const ruta = new URL(subida.body.datos.url).pathname;
      const res = await binario(
        ctx.http().get(ruta).set('Range', 'bytes=100-199'),
      );
      expect(res.status).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 100-199/3000');
      expect(res.headers['accept-ranges']).toBe('bytes');
      expect(
        Buffer.compare(res.body as Buffer, contenido.subarray(100, 200)),
      ).toBe(0);
    });

    it('una clave que no existe da 404 ARCHIVO_NO_ENCONTRADO', async () => {
      const res = await ctx
        .http()
        .get('/archivos/imagenes/2026/09/aaaaaaaaaaaaaaaaaaaaaaaa.jpg');
      expect(res.status).toBe(404);
      expect(res.body.error.codigo).toBe('ARCHIVO_NO_ENCONTRADO');
    });

    it('ARCHIVOS_REDIRIGIR responde 302 a una URL firmada', async () => {
      const otra = await crearApp({
        entorno: {
          ARCHIVOS_PROVEEDOR: 's3proxy',
          S3_ENDPOINT: endpoint,
          S3_BUCKET: `api-${Math.random().toString(36).slice(2, 10)}`,
          ARCHIVOS_REDIRIGIR: 'true',
        },
      });
      try {
        const u = await crearVecino(otra);
        const subida = await otra
          .http()
          .post('/archivos')
          .set(...u.auth)
          .attach('archivo', contenido, 'foto.jpg');
        const res = await otra
          .http()
          .get(new URL(subida.body.datos.url).pathname)
          .redirects(0);
        expect(res.status).toBe(302);
        expect(res.headers.location).toMatch(
          /^http:\/\/127\.0\.0\.1:58080\/.*X-Amz-Signature=/,
        );
      } finally {
        await otra.cerrar();
      }
    });
  });
}
