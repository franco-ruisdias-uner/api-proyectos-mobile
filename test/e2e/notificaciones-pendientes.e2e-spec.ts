// AGENTS §19.3 — Mientras los alumnos no programen el almacén de tokens y el enviador, los tres
// endpoints de /dispositivos responden 501 y el resto de la API sigue andando.
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarError } from '../utilidades/contrato.js';
import { crearVecino } from '../utilidades/usuarios.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ puertosReales: true });
});
afterAll(() => ctx.cerrar());

const TOKEN = 'ExponentPushToken[pendiente-1]';

describe('AGENTS §19.3 — /dispositivos sin implementar', () => {
  it('POST /dispositivos → 501 NO_IMPLEMENTADO', async () => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      501,
      'NO_IMPLEMENTADO',
    );
  });

  it('DELETE /dispositivos/:tokenExpo → 501 NO_IMPLEMENTADO', async () => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
        .set(...v.auth),
      501,
      'NO_IMPLEMENTADO',
    );
  });

  it('POST /dispositivos/prueba → 501 NO_IMPLEMENTADO', async () => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .post('/dispositivos/prueba')
        .set(...v.auth),
      501,
      'NO_IMPLEMENTADO',
    );
  });

  it('el mensaje le dice a los alumnos dónde mirar', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.body.error.mensaje).toBe(
      'Esta parte la programan ustedes. Mirá docs/NOTIFICACIONES.md.',
    );
  });

  it('los flujos que avisan siguen respondiendo bien (la push queda pendiente)', async () => {
    const v = await crearVecino(ctx);
    // PATCH /yo con los avisos prendidos no depende del almacén ni del enviador.
    const res = await ctx
      .http()
      .patch('/yo')
      .set(...v.auth)
      .send({ avisosActivos: true });
    expect(res.status).toBe(200);
  });
});
