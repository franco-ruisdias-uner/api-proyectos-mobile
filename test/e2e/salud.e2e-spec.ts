import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';

describe('AGENTS §11.4 — GET /salud', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('es público y dice motor, almacén y versión', async () => {
    const res = await t.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(res.body.datos).toEqual({
      estado: 'ok',
      motor: process.env.DB_MOTOR ?? 'better-sqlite3',
      almacen: 'local',
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
  });

  it('CORS abierto (la app puede correr en Expo web)', async () => {
    const res = await t.http().get('/salud').set('Origin', 'http://localhost:8081').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('un token inválido en un endpoint público no molesta', async () => {
    await t.http().get('/salud').set('Authorization', 'Bearer basura').expect(200);
  });
});

describe('AGENTS §4.6 — Errores genéricos con el sobre de error', () => {
  let t: AppDePrueba;
  beforeAll(async () => {
    t = await crearApp();
  });
  afterAll(() => t.cerrar());

  it('404 RUTA_NO_ENCONTRADA en una ruta que no existe', async () => {
    const res = await t.http().get('/no-existe').expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });

  it('404 RUTA_NO_ENCONTRADA con un método que la ruta no tiene', async () => {
    const res = await t.http().delete('/salud').expect(404);
    esperarError(res.body, 'RUTA_NO_ENCONTRADA');
  });

  it('400 VALIDACION_FALLIDA con un JSON mal escrito', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('400 VALIDACION_FALLIDA si el cuerpo JSON es enorme', async () => {
    const res = await t
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x'.repeat(2 * 1024 * 1024) }))
      .expect(400);
    esperarError(res.body, 'VALIDACION_FALLIDA');
  });

  it('Swagger está en /docs y su JSON en /docs-json', async () => {
    await t.http().get('/docs').expect(200);
    const res = await t.http().get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/salud',
        '/auth/registro',
        '/auth/ingreso',
        '/yo',
        '/archivos',
        '/dispositivos',
      ]),
    );
  });
});
