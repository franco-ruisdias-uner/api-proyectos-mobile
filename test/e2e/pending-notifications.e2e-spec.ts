import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { crearLinea } from '../utilities/network.js';
import { esperarError } from '../utilities/contract.js';
import { crearUsuario } from '../utilities/users.js';

// AGENTS §19.3: mientras los alumnos no programen el guardado de tokens y el envío de push,
// los tres endpoints de /dispositivos responden 501 y el resto de la API sigue andando.
let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ puertosReales: true });
});
afterAll(() => ctx.cerrar());

describe('AGENTS §19.3 — /dispositivos sin programar: 501 NO_IMPLEMENTADO', () => {
  const token = 'ExponentPushToken[por-hacer]';

  it('POST /dispositivos', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: token, plataforma: 'ios' });
    esperarError(r, 501, 'NO_IMPLEMENTADO');
    expect(r.body.error.mensaje).toBe(
      'Esta parte la programan ustedes. Mirá docs/NOTIFICATIONS.md.',
    );
  });

  it('DELETE /dispositivos/:tokenExpo', async () => {
    const u = await crearUsuario(ctx);
    esperarError(
      await ctx.http.delete(`/dispositivos/${encodeURIComponent(token)}`).set(u.auth),
      501,
      'NO_IMPLEMENTADO',
    );
  });

  it('POST /dispositivos/prueba', async () => {
    const u = await crearUsuario(ctx);
    esperarError(await ctx.http.post('/dispositivos/prueba').set(u.auth), 501, 'NO_IMPLEMENTADO');
  });

  it('sigue pidiendo sesión (401) y validando el cuerpo (400) antes del 501', async () => {
    esperarError(await ctx.http.post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
    const u = await crearUsuario(ctx);
    esperarError(
      await ctx.http.post('/dispositivos').set(u.auth).send({ plataforma: 'ios' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});

describe('AGENTS §19.3 — los flujos que avisan siguen respondiendo bien', () => {
  it('publicar un aviso con una línea favorita responde 201 aunque no haya push', async () => {
    const direccion = await crearUsuario(ctx, { rol: 'direccion' });
    const fan = await crearUsuario(ctx);
    const linea = await crearLinea(ctx);
    await ctx.http.put(`/yo/lineas-favoritas/${linea.id}`).set(fan.auth).expect(200);
    const r = await ctx.http
      .post('/avisos')
      .set(direccion.auth)
      .send({
        titulo: 'Desvío por obra',
        detalle: 'Por obras en calle Corrientes.',
        gravedad: 'desvio',
        lineaIds: [linea.id],
        desde: '2026-09-19T08:00:00-03:00',
        hasta: null,
        trazadoAlternativo: null,
        videoUrl: null,
      });
    expect(r.status).toBe(201);
    await ctx.esperarPush();
  });

  it('el resto de la API no depende de los tokens: GET /yo → 200', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http.get('/yo').set(u.auth).expect(200);
  });
});
