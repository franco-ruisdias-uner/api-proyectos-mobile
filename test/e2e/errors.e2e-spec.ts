import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarError } from '../utilities/contract.js';
import { CATALOGO_ERRORES } from '../../src/common/errors/catalog.js';

describe('AGENTS §4.1 y §4.6 — Sobre de error', () => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.cerrar());

  it('RUTA_NO_ENCONTRADA para una ruta que no existe', async () => {
    const res = await ctx.http().get('/no-existe');
    esperarError(res, 404, 'RUTA_NO_ENCONTRADA');
  });

  it('RUTA_NO_ENCONTRADA para un método que la ruta no tiene', async () => {
    esperarError(await ctx.http().delete('/salud'), 404, 'RUTA_NO_ENCONTRADA');
  });

  it('JSON mal formado → VALIDACION_FALLIDA', async () => {
    const res = await ctx
      .http()
      .post('/auth/ingreso')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com",');
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    expect(res.body.error.mensaje).toBe('El cuerpo del pedido no es un JSON válido.');
  });

  it('el error no trae stack, statusCode ni detalles', async () => {
    const res = await ctx.http().get('/no-existe');
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
  });

  it('catálogo: códigos en MAYUSCULAS_CON_GUION_BAJO y mensajes en castellano, cortos', () => {
    for (const [codigo, { estado, mensaje }] of Object.entries(CATALOGO_ERRORES)) {
      expect(codigo).toMatch(/^[A-Z]+(_[A-Z]+)*$/);
      expect(estado).toBeGreaterThanOrEqual(400);
      expect(mensaje.length).toBeLessThan(120);
      expect(mensaje).toMatch(/\.$/);
    }
  });
});
