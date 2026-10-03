import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';

describe('AGENTS §11.4 — Simulación de fallas con X-Simular', () => {
  describe('con SIMULACION_HABILITADA=true', () => {
    let t: AppDePrueba;
    beforeAll(async () => {
      t = await crearApp({ variables: { SIMULACION_HABILITADA: 'true' } });
    });
    afterAll(() => t.cerrar());

    it('error-500 → 500 ERROR_INTERNO con el sobre de error', async () => {
      const res = await t.http().get('/salud').set('X-Simular', 'error-500').expect(500);
      esperarError(res.body, 'ERROR_INTERNO');
    });

    it('demora-300 responde bien, pero tarde', async () => {
      const inicio = performance.now();
      const res = await t.http().get('/salud').set('X-Simular', 'demora-300').expect(200);
      expect(performance.now() - inicio).toBeGreaterThanOrEqual(290);
      esperarContrato(res.body, 'Salud');
    });

    it('un valor que no entiende se ignora', async () => {
      await t.http().get('/salud').set('X-Simular', 'cualquier-cosa').expect(200);
    });
  });

  describe('con la simulación apagada (como en los tests y en producción)', () => {
    let t: AppDePrueba;
    beforeAll(async () => {
      t = await crearApp();
    });
    afterAll(() => t.cerrar());

    it('la cabecera no hace nada', async () => {
      await t.http().get('/salud').set('X-Simular', 'error-500').expect(200);
    });
  });
});
