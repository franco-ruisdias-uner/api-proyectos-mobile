import { crearApp, type AppDePrueba } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearVecino } from '../utilidades/usuarios.js';
import { Dispositivo } from '../../src/modulos/dispositivos/dispositivo.entidad.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());
beforeEach(() => ctx.notificador.limpiar());

let n = 0;
const token = () =>
  `ExponentPushToken[prueba-${++n}-${Math.random().toString(36).slice(2, 8)}]`;
const dispositivos = () => ctx.dataSource.getRepository(Dispositivo);

describe('POST /dispositivos', () => {
  it('AGENTS §9 — registra el token de Expo del teléfono', async () => {
    const v = await crearVecino(ctx);
    const t = token();
    const res = await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({ tokenExpo: t, plataforma: 'android' });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    expect(await dispositivos().findOneBy({ tokenExpo: t })).toMatchObject({
      usuarioId: v.usuario.id,
    });
  });

  it('AGENTS §10.5 — idempotente: el mismo POST dos veces deja un registro', async () => {
    const v = await crearVecino(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'ios' };
    const a = await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send(cuerpo);
    const b = await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send(cuerpo);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(await dispositivos().countBy({ tokenExpo: cuerpo.tokenExpo })).toBe(
      1,
    );
  });

  it('dos POST simultáneos con el mismo token dejan un registro', async () => {
    const v = await crearVecino(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'ios' };
    const res = await Promise.all([
      ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send(cuerpo),
      ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send(cuerpo),
    ]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await dispositivos().countBy({ tokenExpo: cuerpo.tokenExpo })).toBe(
      1,
    );
  });

  it('AGENTS §9 — si otro usuario tenía el token, pasa al actual', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const t = token();
    await ctx
      .http()
      .post('/dispositivos')
      .set(...a.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    const res = await ctx
      .http()
      .post('/dispositivos')
      .set(...b.auth)
      .send({ tokenExpo: t, plataforma: 'android' });
    expect(res.status).toBe(201);
    const guardados = await dispositivos().findBy({ tokenExpo: t });
    expect(guardados).toHaveLength(1);
    expect(guardados[0].usuarioId).toBe(b.usuario.id);
  });

  it.each([
    ['token que no es de Expo', { tokenExpo: 'abc', plataforma: 'android' }],
    [
      'plataforma desconocida',
      { tokenExpo: 'ExponentPushToken[x]', plataforma: 'windows' },
    ],
    ['sin plataforma', { tokenExpo: 'ExponentPushToken[x]' }],
    ['sin token', { plataforma: 'ios' }],
    [
      'campo de más',
      {
        tokenExpo: 'ExponentPushToken[x]',
        plataforma: 'ios',
        usuarioId: 'usr-1',
      },
    ],
  ])('400 con %s', async (_caso, cuerpo) => {
    const v = await crearVecino(ctx);
    esperarError(
      await ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send(cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx
        .http()
        .post('/dispositivos')
        .send({ tokenExpo: token(), plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('DELETE /dispositivos/:tokenExpo', () => {
  it('AGENTS §4.1 — 204 sin cuerpo y lo borra', async () => {
    const v = await crearVecino(ctx);
    const t = token();
    await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({ tokenExpo: t, plataforma: 'ios' });
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(...v.auth);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await dispositivos().countBy({ tokenExpo: t })).toBe(0);
  });

  it('borrar algo que ya no está también da 204 (la app puede reintentar)', async () => {
    const v = await crearVecino(ctx);
    const res = await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token())}`)
      .set(...v.auth);
    expect(res.status).toBe(204);
  });

  it('no borra el dispositivo de otro usuario', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const t = token();
    await ctx
      .http()
      .post('/dispositivos')
      .set(...a.auth)
      .send({ tokenExpo: t, plataforma: 'ios' });
    await ctx
      .http()
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(...b.auth)
      .expect(204);
    expect(await dispositivos().countBy({ tokenExpo: t })).toBe(1);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(token())}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('POST /dispositivos/prueba', () => {
  it('AGENTS §9 — manda una push de prueba a los dispositivos del usuario', async () => {
    const v = await crearVecino(ctx);
    const otro = await crearVecino(ctx);
    const [t1, t2, t3] = [token(), token(), token()];
    for (const t of [t1, t2]) {
      await ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send({ tokenExpo: t, plataforma: 'android' });
    }
    await ctx
      .http()
      .post('/dispositivos')
      .set(...otro.auth)
      .send({ tokenExpo: t3, plataforma: 'ios' });

    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.status).toBe(200);
    esperarContrato(res, 'PruebaDePush');
    expect(res.body.datos).toEqual({ enviadas: 2 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo).sort()).toEqual(
      [t1, t2].sort(),
    );
    expect(ctx.notificador.enviadas[0]).toMatchObject({
      titulo: expect.any(String),
      cuerpo: expect.any(String),
    });
  });

  it('AGENTS §9 — respeta el interruptor de avisos', async () => {
    const v = await crearVecino(ctx, { avisosActivos: false });
    await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({ tokenExpo: token(), plataforma: 'ios' });
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.body.datos).toEqual({ enviadas: 0 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('AGENTS §9 — los tokens que Expo informa como inválidos se borran', async () => {
    const v = await crearVecino(ctx);
    const [bueno, malo] = [token(), token()];
    for (const t of [bueno, malo]) {
      await ctx
        .http()
        .post('/dispositivos')
        .set(...v.auth)
        .send({ tokenExpo: t, plataforma: 'android' });
    }
    ctx.notificador.marcarInvalido(malo);
    await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth)
      .expect(200);
    await ctx.esperarAvisos();
    expect(await dispositivos().countBy({ tokenExpo: malo })).toBe(0);
    expect(await dispositivos().countBy({ tokenExpo: bueno })).toBe(1);
  });

  it('AGENTS §9 — un error del proveedor de push no rompe el pedido', async () => {
    const v = await crearVecino(ctx);
    await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({ tokenExpo: token(), plataforma: 'android' });
    ctx.notificador.fallarProximoEnvio();
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.status).toBe(200);
    await ctx.esperarAvisos();
  });

  it('sin dispositivos: enviadas 0', async () => {
    const v = await crearVecino(ctx);
    expect(
      (
        await ctx
          .http()
          .post('/dispositivos/prueba')
          .set(...v.auth)
      ).body.datos,
    ).toEqual({ enviadas: 0 });
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http().post('/dispositivos/prueba'),
      401,
      'NO_AUTENTICADO',
    );
  });
});
