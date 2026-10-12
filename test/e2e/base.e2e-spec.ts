import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { bearer, conSesion } from '../utilidades/usuarios.js';

describe('M0 — Base común', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());

  describe('AGENTS §11.4 — GET /salud', () => {
    it('es público y dice motor, almacén y versión', async () => {
      const r = await c.http().get('/salud').expect(200);
      esperarContrato(r.body, 'Salud');
      expect(r.body.datos).toEqual({
        estado: 'ok',
        motor: process.env.DB_MOTOR ?? 'better-sqlite3',
        almacen: 'local',
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      });
    });

    it('CORS abierto (la app puede correr en Expo web)', async () => {
      const r = await c
        .http()
        .get('/salud')
        .set('Origin', 'http://localhost:8081')
        .expect(200);
      expect(r.headers['access-control-allow-origin']).toBe('*');
    });
  });

  describe('ESPECIFICACION §7 — Una dirección que no existe da RECURSO_NO_ENCONTRADO', () => {
    it.each([
      ['get', '/no-existe'],
      ['post', '/auth/registro'],
      ['get', '/'],
    ])('%s %s', async (metodo, ruta) => {
      const { token } = await conSesion(c, 'administracion');
      const r = await c
        .http()
        [metodo as 'get' | 'post'](ruta)
        .set(bearer(token))
        .expect(404);
      esperarError(r.body, 'RECURSO_NO_ENCONTRADO');
      expect(r.body.error.mensaje).toBe('Esa dirección no existe en la API.');
    });

    it('también sin sesión: la dirección no existe para nadie', async () => {
      const r = await c.http().get('/no-existe').expect(404);
      esperarError(r.body, 'RECURSO_NO_ENCONTRADO');
    });
  });

  describe('AGENTS §4.6 — El sobre de error no lleva nada más que código y mensaje', () => {
    it('JSON roto → 400 VALIDACION_FALLIDA, sin detalles técnicos', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .set('Content-Type', 'application/json')
        .send('{"legajo": ')
        .expect(400);
      esperarError(r.body, 'VALIDACION_FALLIDA');
      expect(JSON.stringify(r.body)).not.toMatch(/Unexpected|JSON|position/);
    });

    it('un cuerpo enorme → 413 con el sobre', async () => {
      const r = await c
        .http()
        .post('/auth/ingreso')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ legajo: 'x'.repeat(200_000), contrasena: 'y' }))
        .expect(413);
      esperarError(r.body, 'ARCHIVO_DEMASIADO_GRANDE');
    });
  });

  describe('AGENTS §11.4 — Sin simulación en tests', () => {
    it('X-Simular se ignora si SIMULACION_HABILITADA no está', async () => {
      await c.http().get('/salud').set('X-Simular', 'error-500').expect(200);
    });
  });

  describe('AGENTS §11.5 — Swagger en /docs', () => {
    it('documenta los endpoints de M0 con sus errores', async () => {
      const r = await c.http().get('/docs-json').expect(200);
      const rutas = Object.keys(r.body.paths as object);
      expect(rutas).toEqual(
        expect.arrayContaining([
          '/salud',
          '/auth/ingreso',
          '/auth/salida',
          '/yo',
          '/usuarios',
          '/usuarios/{id}',
          '/archivos',
          '/dispositivos',
          '/dispositivos/prueba',
          '/dispositivos/{tokenExpo}',
        ]),
      );
      expect(rutas).not.toContain('/auth/registro');
      const errores = JSON.stringify(r.body.paths['/usuarios'].post.responses);
      expect(errores).toContain('LEGAJO_YA_REGISTRADO');
      expect(errores).toContain('SIN_PERMISO');
    });
  });

  describe('AGENTS §5.2 — Estabilidad del esquema', () => {
    it('después de sincronizar no queda ninguna consulta pendiente', async () => {
      const pendientes = await c.dataSource.driver.createSchemaBuilder().log();
      expect(pendientes.upQueries.map((q) => q.query)).toEqual([]);
    });
  });
});
