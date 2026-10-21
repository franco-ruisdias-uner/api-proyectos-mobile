// Consigna de los alumnos (docs/NOTIFICATIONS.md): casos borde de /dispositivos. Vienen de la
// verificación independiente de M0 y se mudaron acá en M8 (AGENTS §19.3). Contra la app real.
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, registrarTurista } from '../utilities/builders.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { levantarExpoFalso, type ExpoFalso } from '../utilities/fake-expo.js';

let n = 0;
const emailUnico = (base = 'verif') => `${base}${++n}-${Math.random().toString(36).slice(2, 8)}@prueba.ar`;
const CAMEL = /\b[a-z]+[A-Z][a-zA-Z]*\b/;

/** Un error 400 con mensaje en castellano que no nombra el campo en camelCase ni en inglés. */
function esperarValidacion(res: { status: number; body: unknown }) {
  esperarError(res, 400, 'VALIDACION_FALLIDA');
  const { mensaje } = (res.body as { error: { mensaje: string } }).error;
  expect(mensaje).not.toMatch(CAMEL);
  expect(mensaje).not.toMatch(/\b(should|must|property|string|number|array|object|boolean|is not)\b/i);
}

let expo: ExpoFalso;
beforeAll(async () => {
  expo = await levantarExpoFalso();
});
afterAll(() => expo.cerrar());
const crear = () => crearApp({ reales: true, entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url } });

describe('AGENTS §9 — /dispositivos: bordes', () => {
  let ctx: AppDePrueba;
  let lucia: string;
  let pedro: string;
  const TOKEN = 'ExponentPushToken[vvvvvvvvvvvvvvvvvvvvvv]';
  beforeEach(async () => {
    expo.limpiar();
    ctx = await crear();
    lucia = (await registrarTurista(ctx, { email: emailUnico() })).token;
    pedro = (await registrarTurista(ctx, { email: emailUnico() })).token;
  });
  afterEach(() => ctx.cerrar());
  const registrar = (t: string, cuerpo: object) =>
    ctx.http().post('/dispositivos').set(conSesion(t)).send(cuerpo);

  it('campo de más → 400', async () => {
    esperarValidacion(await registrar(lucia, { tokenExpo: TOKEN, plataforma: 'ios', modelo: 'iPhone' }));
  });

  it.each([
    [{ tokenExpo: 42, plataforma: 'ios' }],
    [{ tokenExpo: '', plataforma: 'ios' }],
    [{ tokenExpo: TOKEN, plataforma: 'IOS' }],
    [{ tokenExpo: TOKEN, plataforma: null }],
  ])('→ 400 con mensaje en castellano: %j', async (cuerpo) => {
    esperarValidacion(await registrar(lucia, cuerpo));
  });

  it('el formato ExpoPushToken[…] (también válido para Expo) se acepta', async () => {
    const res = await registrar(lucia, {
      tokenExpo: 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      plataforma: 'android',
    });
    expect([200, 201]).toContain(res.status);
    esperarContrato(res.body, 'Dispositivo');
  });

  it('cambiar la plataforma del mismo token: 200 con la plataforma nueva', async () => {
    await registrar(lucia, { tokenExpo: TOKEN, plataforma: 'android' }).expect(201);
    const res = await registrar(lucia, { tokenExpo: TOKEN, plataforma: 'ios' }).expect(200);
    esperarContrato(res.body, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: TOKEN, plataforma: 'ios' });
  });

  it('concurrencia: dos usuarios registran el mismo token a la vez → queda uno solo, sin 500', async () => {
    const r = await Promise.all([
      registrar(lucia, { tokenExpo: TOKEN, plataforma: 'ios' }),
      registrar(pedro, { tokenExpo: TOKEN, plataforma: 'ios' }),
    ]);
    for (const res of r) expect([200, 201]).toContain(res.status);
    const [pl, pp] = await Promise.all([
      ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)),
      ctx.http().post('/dispositivos/prueba').set(conSesion(pedro)),
    ]);
    expect(pl.body.datos.enviadas + pp.body.datos.enviadas).toBe(1);
  });

  it('después de que el token pasa a otro usuario, la prueba del primero manda 0', async () => {
    await registrar(lucia, { tokenExpo: TOKEN, plataforma: 'ios' }).expect(201);
    await registrar(pedro, { tokenExpo: TOKEN, plataforma: 'ios' }).expect(200);
    const res = await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    esperarContrato(res.body, 'PruebaNotificacion');
    expect(res.body.datos.enviadas).toBe(0);
    await ctx.esperarAvisos();
    expect(expo.pedidos).toHaveLength(0);
  });

  it('la push de prueba tiene título y cuerpo en castellano', async () => {
    await registrar(lucia, { tokenExpo: TOKEN, plataforma: 'ios' }).expect(201);
    await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    await ctx.esperarAvisos();
    expect(expo.mensajes()).toHaveLength(1);
    const envio = expo.mensajes()[0];
    expect(JSON.stringify(envio)).not.toMatch(/\btest\b|lorem/i);
  });

  it('DELETE con un token que nunca existió → 204', async () => {
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent('ExponentPushToken[nunca]')}`)
      .set(conSesion(lucia));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });
});

describe('M0-6 — DELETE /dispositivos/:tokenExpo de un token ajeno: 204 y no borra nada', () => {
  let ctx: AppDePrueba;
  let lucia: string;
  let pedro: string;
  const TOKEN = 'ExponentPushToken[ajenoajenoajenoajeno12]';
  beforeEach(async () => {
    expo.limpiar();
    ctx = await crear();
    lucia = (await registrarTurista(ctx, { email: emailUnico() })).token;
    pedro = (await registrarTurista(ctx, { email: emailUnico() })).token;
    await ctx
      .http()
      .post('/dispositivos')
      .set(conSesion(lucia))
      .send({ tokenExpo: TOKEN, plataforma: 'ios' })
      .expect(201);
  });
  afterEach(() => ctx.cerrar());

  it('Pedro borra el token de Lucía → 204 sin cuerpo, y Lucía sigue recibiendo', async () => {
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(conSesion(pedro));
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    const prueba = await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    esperarContrato(prueba.body, 'PruebaNotificacion');
    expect(prueba.body.datos.enviadas).toBe(1);
  });

  it('la respuesta a un token ajeno es idéntica a la de uno inexistente (no revela de quién es)', async () => {
    const ajeno = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
      .set(conSesion(pedro));
    const inexistente = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent('ExponentPushToken[noexistenoexiste12345]')}`)
      .set(conSesion(pedro));
    expect(ajeno.status).toBe(inexistente.status);
    expect(ajeno.text).toBe(inexistente.text);
  });

  it('Lucía borra el suyo → 204 y deja de recibir; repetir el DELETE sigue dando 204', async () => {
    for (let i = 0; i < 2; i++) {
      await ctx
        .http()
        .delete(`/dispositivos/${encodeURIComponent(TOKEN)}`)
        .set(conSesion(lucia))
        .expect(204);
    }
    const prueba = await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    expect(prueba.body.datos.enviadas).toBe(0);
  });

  it('DELETE sin sesión → 401', async () => {
    esperarError(
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(TOKEN)}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});
