// Verificación independiente de M8 — Notificaciones para completar (AGENTS §19.3). Caja negra.
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, crearAdmin, crearEvento, registrarTurista } from '../utilities/builders.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

describe.each(['registro', 'expo'])('AGENTS §19.3 — /dispositivos vacío (NOTIFICACIONES=%s)', (modo) => {
  let ctx: AppDePrueba;
  let token: string;
  beforeAll(async () => {
    ctx = await crearApp({ reales: true, entorno: { NOTIFICACIONES: modo } });
    token = (await registrarTurista(ctx)).token;
  });
  afterAll(() => ctx.cerrar());

  it('501 NO_IMPLEMENTADO con sobre exacto en los tres endpoints', async () => {
    const r = [
      await ctx.http().post('/dispositivos').set(conSesion(token)).send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      await ctx.http().post('/dispositivos/prueba').set(conSesion(token)),
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(TOKEN)}`).set(conSesion(token)),
    ];
    for (const res of r) {
      esperarError(res, 501, 'NO_IMPLEMENTADO');
      expect(Object.keys(res.body)).toEqual(['error']);
      expect(Object.keys(res.body.error).sort()).toEqual(['codigo', 'mensaje']);
      expect(res.body.error.mensaje).toMatch(/ustedes/);
    }
  });

  it('401 sin sesión, con token mal firmado, en los tres', async () => {
    for (const [m, ruta] of [
      ['post', '/dispositivos'],
      ['post', '/dispositivos/prueba'],
      ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`],
    ] as const) {
      esperarError(await ctx.http()[m](ruta), 401, 'NO_AUTENTICADO');
      esperarError(await ctx.http()[m](ruta).set(conSesion(token + 'x')), 401, 'NO_AUTENTICADO');
    }
  });

  it('400 VALIDACION_FALLIDA en el POST: plataforma inválida, campo de más, faltante, tipos', async () => {
    const malos = [
      { tokenExpo: TOKEN, plataforma: 'windows' },
      { tokenExpo: TOKEN, plataforma: 'ios', extra: 1 },
      { plataforma: 'ios' },
      { tokenExpo: TOKEN },
      { tokenExpo: 123, plataforma: 'ios' },
      { tokenExpo: '', plataforma: 'ios' },
      {},
    ];
    for (const cuerpo of malos) {
      const res = await ctx.http().post('/dispositivos').set(conSesion(token)).send(cuerpo);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    }
  });

  it('la API sigue sirviendo el resto: /salud, /yo, /lugares', async () => {
    esperarContrato((await ctx.http().get('/salud').expect(200)).body, 'Salud');
    esperarContrato((await ctx.http().get('/yo').set(conSesion(token)).expect(200)).body, 'Usuario');
    esperarContrato((await ctx.http().get('/lugares').expect(200)).body, 'Lugar');
  });
});

describe.each(['registro', 'expo'])('AGENTS §19.2 — los flujos que avisan no se rompen (NOTIFICACIONES=%s)', (modo) => {
  let ctx: AppDePrueba;
  beforeAll(async () => {
    ctx = await crearApp({ reales: true, entorno: { NOTIFICACIONES: modo } });
  });
  afterAll(() => ctx.cerrar());

  it('suspender, reprogramar y cancelar con eventos guardados dan 200 y el estado correcto', async () => {
    const admin = await crearAdmin(ctx);
    const a = (await registrarTurista(ctx)).token;
    const b = (await registrarTurista(ctx)).token;
    const id = await crearEvento(ctx, { inicio: new Date('2026-11-20T21:00:00-03:00') });
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(a)).expect(201);
    await ctx.http().put(`/yo/eventos-guardados/${id}`).set(conSesion(b)).expect(201);

    for (const estado of ['suspendido', 'programado', 'cancelado']) {
      const res = await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado });
      expect(res.status).toBe(200);
      esperarContrato(res.body, 'Evento');
      expect(res.body.datos.estado).toBe(estado);
    }
    await ctx.esperarAvisos();
    const g = await ctx.http().get('/yo/eventos-guardados').set(conSesion(a)).expect(200);
    esperarContrato(g.body, 'Evento');
    expect(g.body.datos[0].estado).toBe('cancelado');
  });

  it('sin guardados, y mismo estado, también 200; turista sigue con 403', async () => {
    const admin = await crearAdmin(ctx);
    const t = (await registrarTurista(ctx)).token;
    const id = await crearEvento(ctx, { inicio: new Date('2026-11-21T21:00:00-03:00') });
    await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado: 'suspendido' }).expect(200);
    await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado: 'suspendido' }).expect(200);
    esperarError(
      await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(t)).send({ estado: 'cancelado' }),
      403,
      'SIN_PERMISO',
    );
    esperarError(
      await ctx.http().patch(`/eventos/${id}/estado`).set(conSesion(admin.token)).send({ estado: 'finalizado' }),
      400,
      'VALIDACION_FALLIDA',
    );
  });
});
