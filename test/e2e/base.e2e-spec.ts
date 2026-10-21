import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearVecino } from '../utilities/users.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());

describe('GET /salud', () => {
  it('AGENTS §11.4 — es pública y dice motor, almacén y versión', async () => {
    const res = await ctx.http().get('/salud');
    expect(res.status).toBe(200);
    esperarContrato(res, 'Salud');
    expect(res.body.datos).toEqual({
      estado: 'ok',
      motor: process.env.DB_MOTOR ?? 'better-sqlite3',
      almacen: 'local',
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
  });
});

describe('AGENTS §4.6 — Sobre de error', () => {
  it('404 RUTA_NO_ENCONTRADA para una ruta que no existe', async () => {
    esperarError(await ctx.http().get('/no-existe'), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('404 RUTA_NO_ENCONTRADA con un método que la ruta no tiene', async () => {
    esperarError(await ctx.http().delete('/salud'), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('400 VALIDACION_FALLIDA con JSON mal formado, sin detalles técnicos', async () => {
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).not.toMatch(/JSON|Unexpected|token/i);
  });

  it('413 ARCHIVO_DEMASIADO_GRANDE con un cuerpo JSON enorme', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ nombre: 'x'.repeat(2 * 1024 * 1024) });
    esperarError(res, 413, 'ARCHIVO_DEMASIADO_GRANDE');
  });

  it('el error nunca trae stack, statusCode ni detalles', async () => {
    const res = await ctx.http().get('/no-existe');
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });
});

describe('AGENTS §11.4 — Pensado para alumnos', () => {
  it('CORS abierto', async () => {
    const res = await ctx
      .http()
      .get('/salud')
      .set('Origin', 'http://localhost:8081');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('AGENTS §11.5 — Swagger en /docs y /docs-json', async () => {
    const res = await ctx.http().get('/docs-json');
    expect(res.status).toBe(200);
    expect(res.body.paths).toHaveProperty('/salud');
    expect(res.body.paths).toHaveProperty('/auth/registro');
    expect((await ctx.http().get('/docs')).status).toBe(200);
  });

  it('la simulación está apagada en los tests', async () => {
    const res = await ctx.http().get('/salud').set('X-Simular', 'error-500');
    expect(res.status).toBe(200);
  });
});

describe('AGENTS §11.4 — Simulación de fallas (SIMULACION_HABILITADA=true)', () => {
  let sim: AppDePrueba;
  beforeAll(async () => {
    sim = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
  });
  afterAll(() => sim.cerrar());

  it('X-Simular: error-500 devuelve ERROR_INTERNO', async () => {
    esperarError(
      await sim.http().get('/salud').set('X-Simular', 'error-500'),
      500,
      'ERROR_INTERNO',
    );
  });

  it('también en rutas con sesión, antes de pedir el token', async () => {
    esperarError(
      await sim.http().get('/yo').set('X-Simular', 'error-500'),
      500,
      'ERROR_INTERNO',
    );
  });

  it('X-Simular: demora-300 responde bien, pero tarde', async () => {
    const inicio = performance.now();
    const res = await sim.http().get('/salud').set('X-Simular', 'demora-300');
    expect(res.status).toBe(200);
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
  });

  it('un valor desconocido se ignora', async () => {
    expect(
      (await sim.http().get('/salud').set('X-Simular', 'cualquiera')).status,
    ).toBe(200);
  });
});
