import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';

describe('AGENTS §11.4 — Simulación de fallas con X-Simular', () => {
  describe('con SIMULACION_HABILITADA=true', () => {
    let ctx: AppDePrueba;
    beforeAll(async () => {
      ctx = await crearApp({ entorno: { SIMULACION_HABILITADA: 'true' } });
    });
    afterAll(() => ctx.cerrar());

    it('X-Simular: error-500 → ERROR_INTERNO', async () => {
      const res = await ctx.http().get('/salud').set('X-Simular', 'error-500');
      esperarError(res, 500, 'ERROR_INTERNO');
    });

    it('X-Simular: demora-300 responde bien pero tarde', async () => {
      const inicio = performance.now();
      const res = await ctx.http().get('/salud').set('X-Simular', 'demora-300').expect(200);
      expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
      esperarContrato(res.body, 'Salud');
    });

    it('un valor desconocido se ignora', async () => {
      await ctx.http().get('/salud').set('X-Simular', 'cualquier-cosa').expect(200);
    });
  });

  describe('con SIMULACION_HABILITADA=false', () => {
    let ctx: AppDePrueba;
    beforeAll(async () => {
      ctx = await crearApp();
    });
    afterAll(() => ctx.cerrar());

    it('la cabecera no hace nada', async () => {
      await ctx.http().get('/salud').set('X-Simular', 'error-500').expect(200);
    });
  });
});
