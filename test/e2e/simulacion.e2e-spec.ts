import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarError } from '../utilidades/contrato.js';

describe('AGENTS §11.4 — Simulación de fallas con X-Simular', () => {
  let c: AppDePrueba;
  beforeAll(
    async () =>
      (c = await crearApp({ entorno: { SIMULATION_ENABLED: 'true' } })),
  );
  afterAll(() => c.cerrar());

  it('error-500 devuelve ERROR_INTERNO con el sobre', async () => {
    const r = await c
      .http()
      .get('/salud')
      .set('X-Simular', 'error-500')
      .expect(500);
    esperarError(r.body, 'ERROR_INTERNO');
  });

  it('error-500 también en un endpoint con sesión, antes de pedir el token', async () => {
    const r = await c
      .http()
      .get('/yo')
      .set('X-Simular', 'error-500')
      .expect(500);
    esperarError(r.body, 'ERROR_INTERNO');
  });

  it('demora-300 responde bien, 300 ms tarde', async () => {
    const inicio = performance.now();
    await c.http().get('/salud').set('X-Simular', 'demora-300').expect(200);
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
  });

  it('un valor desconocido se ignora', async () => {
    await c.http().get('/salud').set('X-Simular', 'lo-que-sea').expect(200);
  });
});
