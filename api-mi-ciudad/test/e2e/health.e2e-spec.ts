import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato } from '../utilities/contract.js';

describe('AGENTS §11.4 — GET /salud', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('es público y dice motor, almacén y versión', async () => {
    const res = await ctx.http().get('/salud').expect(200);
    esperarContrato(res.body, 'Salud');
    expect(res.body.datos).toEqual({
      estado: 'ok',
      motor: process.env.DB_MOTOR,
      almacen: 'local',
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
  });

  it('CORS abierto (la app puede correr en Expo web)', async () => {
    const res = await ctx.http().get('/salud').set('Origin', 'http://localhost:8081').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
