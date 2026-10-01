// Verificación independiente de M0 (AGENTS §9) que cubre /dispositivos: pasó a la consigna de
// los alumnos (AGENTS §19.3) porque el guardado de tokens y el envío los programan ellos.
import type { Response } from 'supertest';
import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearOperador, crearVecino } from '../utilidades/usuarios.js';

let ctx: AppDePrueba;
const AHORA = '2026-09-14T10:00:00-03:00';
beforeAll(async () => {
  ctx = await crearApp({ ahora: AHORA, puertosReales: true });
});
afterAll(() => ctx.cerrar());
beforeEach(async () => {
  await ctx.esperarAvisos();
  ctx.reloj.mover(AHORA);
  ctx.notificador.limpiar();
});

const patch = (auth: [string, string], cuerpo: unknown) =>
  ctx
    .http()
    .patch('/yo')
    .set(...auth)
    .send(cuerpo as object);

/** Jerga técnica o inglés que no puede aparecer en un mensaje para el vecino. */
const JERGA =
  /\b(must|should|property|undefined|null|cannot|exception|invalid|string|boolean|number|array|entity|column|constraint|sql|jwt|bearer|multipart|mime|payload|body)\b/i;
function mensajeParaPersonas(res: Response): void {
  const mensaje = (res.body as { error: { mensaje: string } }).error.mensaje;
  expect(mensaje).not.toMatch(JERGA);
  expect(mensaje).not.toMatch(/usr-|[A-Z_]{6,}/);
}

describe('AGENTS §9 — apagar los avisos corta la push de prueba', () => {
  it('AGENTS §9 — apagar los avisos corta la push de prueba', async () => {
    const v = await crearVecino(ctx);
    await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({
        tokenExpo: `ExponentPushToken[av-${Date.now()}]`,
        plataforma: 'ios',
      })
      .expect(201);
    await patch(v.auth, { avisosActivos: false }).expect(200);
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.body.datos).toEqual({ enviadas: 0 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });
});

describe('AGENTS §9 — /dispositivos', () => {
  const alta = (auth: [string, string], cuerpo: unknown) =>
    ctx
      .http()
      .post('/dispositivos')
      .set(...auth)
      .send(cuerpo as object);
  let n = 0;
  const tok = (pref = 'ExponentPushToken') =>
    `${pref}[verif-${++n}-${Math.random().toString(36).slice(2, 8)}]`;

  it('acepta también el formato nuevo ExpoPushToken[…]', async () => {
    const v = await crearVecino(ctx);
    const t = tok('ExpoPushToken');
    const res = await alta(v.auth, { tokenExpo: t, plataforma: 'ios' });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: t, plataforma: 'ios' });
  });

  it('el mismo token con otra plataforma no duplica y devuelve la plataforma nueva', async () => {
    const v = await crearVecino(ctx);
    const t = tok();
    await alta(v.auth, { tokenExpo: t, plataforma: 'android' }).expect(201);
    const res = await alta(v.auth, { tokenExpo: t, plataforma: 'ios' });
    expect([200, 201]).toContain(res.status);
    esperarContrato(res, 'Dispositivo');
    expect(res.body.datos.plataforma).toBe('ios');
    const prueba = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(prueba.body.datos).toEqual({ enviadas: 1 });
  });

  it.each([
    ['plataforma en mayúsculas', { plataforma: 'IOS' }],
    ['plataforma "web"', { plataforma: 'web' }],
    ['plataforma null', { plataforma: null }],
    ['tokenExpo numérico', { tokenExpo: 123 }],
    ['tokenExpo vacío', { tokenExpo: '' }],
    [
      'tokenExpo sin corchete de cierre',
      { tokenExpo: 'ExponentPushToken[abc' },
    ],
  ])('400 VALIDACION_FALLIDA con %s', async (_caso, parcial) => {
    const v = await crearVecino(ctx);
    const res = await alta(v.auth, {
      tokenExpo: tok(),
      plataforma: 'android',
      ...parcial,
    });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
    mensajeParaPersonas(res);
  });

  it('cuando el token pasa a otro usuario, el anterior ya no recibe la push de prueba', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const t = tok();
    await alta(a.auth, { tokenExpo: t, plataforma: 'android' }).expect(201);
    await alta(b.auth, { tokenExpo: t, plataforma: 'android' });
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...a.auth);
    expect(res.body.datos).toEqual({ enviadas: 0 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('DELETE con el token codificado en la URL (corchetes) da 204 sin cuerpo y lo borra', async () => {
    const v = await crearVecino(ctx);
    const t = tok();
    await alta(v.auth, { tokenExpo: t, plataforma: 'ios' }).expect(201);
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(...v.auth);
    expect(res.status).toBe(204);
    expect(res.text ?? '').toBe('');
    const prueba = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(prueba.body.datos).toEqual({ enviadas: 0 });
  });

  it('DELETE del token de otro usuario no se lo saca: el dueño sigue recibiendo', async () => {
    const duenio = await crearVecino(ctx);
    const intruso = await crearVecino(ctx);
    const t = tok();
    await alta(duenio.auth, { tokenExpo: t, plataforma: 'ios' }).expect(201);
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(...intruso.auth);
    expect([204, 403, 404]).toContain(res.status);
    if (res.status !== 204) expect(Object.keys(res.body)).toEqual(['error']);
    const prueba = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...duenio.auth);
    expect(prueba.body.datos).toEqual({ enviadas: 1 });
  });

  it('la push de prueba lleva título y cuerpo en castellano, sin jerga', async () => {
    const op = await crearOperador(ctx);
    await alta(op.auth, { tokenExpo: tok(), plataforma: 'android' }).expect(
      201,
    );
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...op.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'PruebaDePush');
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(1);
    const { titulo, cuerpo } = ctx.notificador.enviadas[0] as {
      titulo: string;
      cuerpo: string;
    };
    expect(titulo.trim()).not.toBe('');
    expect(cuerpo.trim()).not.toBe('');
    expect(`${titulo} ${cuerpo}`).not.toMatch(
      /\b(test|push notification|token)\b/i,
    );
  });

  it('401 en DELETE con token adulterado', async () => {
    esperarError(
      await ctx
        .http()
        .delete(`/dispositivos/${encodeURIComponent(tok())}`)
        .set('Authorization', 'Bearer a.b.c'),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §9 / §5.3 — /dispositivos con entradas raras', () => {
  it('un token de Expo enorme: 400, nunca 500 (varchar en MySQL/PostgreSQL)', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({
        tokenExpo: `ExponentPushToken[${'a'.repeat(600)}]`,
        plataforma: 'ios',
      });
    esperarError(res, 400, 'VALIDACION_FALLIDA');
  });

  it('DELETE de algo que no es un token de Expo no da 500', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .delete('/dispositivos/hola')
      .set(...v.auth);
    expect([204, 400, 404]).toContain(res.status);
    if (res.status !== 204) expect(Object.keys(res.body)).toEqual(['error']);
  });

  it('la push de prueba cuenta sólo los dispositivos propios', async () => {
    const v = await crearVecino(ctx);
    const otro = await crearVecino(ctx);
    const s = Math.random().toString(36).slice(2, 8);
    for (const [u, t] of [
      [v, `ExponentPushToken[a-${s}]`],
      [v, `ExpoPushToken[b-${s}]`],
      [otro, `ExponentPushToken[c-${s}]`],
    ] as const) {
      await ctx
        .http()
        .post('/dispositivos')
        .set(...u.auth)
        .send({ tokenExpo: t, plataforma: 'android' })
        .expect(201);
    }
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'PruebaDePush');
    expect(res.body.datos).toEqual({ enviadas: 2 });
  });
});

describe('AGENTS §9 / §5.5 — Dos usuarios registran el mismo token de Expo a la vez', () => {
  it('ninguno recibe 500 y el token queda de uno solo', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const t = `ExponentPushToken[verif-carrera-${Math.random().toString(36).slice(2, 8)}]`;
    const cuerpo = { tokenExpo: t, plataforma: 'android' };
    const res = await Promise.all(
      [a, b, a, b].map((u) =>
        ctx
          .http()
          .post('/dispositivos')
          .set(...u.auth)
          .send(cuerpo),
      ),
    );
    for (const r of res) {
      expect([200, 201]).toContain(r.status);
      esperarContrato(r, 'Dispositivo');
    }
    const enviadas = await Promise.all(
      [a, b].map(
        async (u) =>
          (
            await ctx
              .http()
              .post('/dispositivos/prueba')
              .set(...u.auth)
          ).body.datos.enviadas as number,
      ),
    );
    expect(enviadas[0] + enviadas[1]).toBe(1);
  });
});
