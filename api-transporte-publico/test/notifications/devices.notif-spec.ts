import { AlmacenTokensPush } from '../../src/common/notifications/ports.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario } from '../utilities/users.js';
import { type AppConExpoFalso, crearAppConExpoFalso, tokenNuevo } from './fake-expo.js';

// Consigna de los alumnos (parte 1): guardar los tokens de Expo de cada usuario.
// Se completa en `src/student-notifications/`. Ver docs/NOTIFICATIONS.md.

let ctx: AppConExpoFalso;
beforeAll(async () => {
  ctx = await crearAppConExpoFalso();
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.expo.vaciar();
  ctx.expo.noRegistrados.clear();
  ctx.expo.caido = false;
});

const tokensDe = (...usuarioIds: string[]) => ctx.app.get(AlmacenTokensPush).tokensDe(usuarioIds);

describe('Guardar el token: POST /dispositivos tiene que dejar el token del teléfono asociado al usuario', () => {
  it('registra el token del teléfono y responde 201 con { tokenExpo, plataforma }', async () => {
    const u = await crearUsuario(ctx);
    const t = tokenNuevo();
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    esperarContrato(r.body, 'Dispositivo');
    expect(r.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    expect(await tokensDe(u.id)).toEqual([t]);
  });

  it('acepta también el formato ExpoPushToken[…]', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: 'ExpoPushToken[abcdef123]', plataforma: 'ios' })
      .expect(201);
    expect(await tokensDe(u.id)).toEqual(['ExpoPushToken[abcdef123]']);
  });

  it('un usuario puede tener varios teléfonos', async () => {
    const u = await crearUsuario(ctx);
    const [a, b] = [tokenNuevo(), tokenNuevo()];
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: a, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: b, plataforma: 'android' });
    expect((await tokensDe(u.id)).sort()).toEqual([a, b].sort());
  });

  it('es idempotente: el mismo token dos veces deja un solo registro y la misma respuesta', async () => {
    const u = await crearUsuario(ctx);
    const cuerpo = { tokenExpo: tokenNuevo(), plataforma: 'ios' };
    const a = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo).expect(201);
    const b = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo).expect(201);
    expect(b.body).toEqual(a.body);
    expect(await tokensDe(u.id)).toEqual([cuerpo.tokenExpo]);
  });

  it('dos registros simultáneos del mismo token dejan uno solo', async () => {
    const u = await crearUsuario(ctx);
    const cuerpo = { tokenExpo: tokenNuevo(), plataforma: 'android' };
    const rs = await Promise.all([
      ctx.http.post('/dispositivos').set(u.auth).send(cuerpo),
      ctx.http.post('/dispositivos').set(u.auth).send(cuerpo),
    ]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect(await tokensDe(u.id)).toEqual([cuerpo.tokenExpo]);
  });

  it('si otro usuario tenía el token, pasa al usuario actual (y deja de ser del anterior)', async () => {
    const antes = await crearUsuario(ctx);
    const ahora = await crearUsuario(ctx);
    const t = tokenNuevo();
    await ctx.http
      .post('/dispositivos')
      .set(antes.auth)
      .send({ tokenExpo: t, plataforma: 'android' });
    await ctx.http
      .post('/dispositivos')
      .set(ahora.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    expect(await tokensDe(antes.id)).toEqual([]);
    expect(await tokensDe(ahora.id)).toEqual([t]);
  });

  it('dos cuentas registran el mismo token a la vez: queda en una sola', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const t = tokenNuevo();
    const rs = await Promise.all([
      ctx.http.post('/dispositivos').set(a.auth).send({ tokenExpo: t, plataforma: 'ios' }),
      ctx.http.post('/dispositivos').set(b.auth).send({ tokenExpo: t, plataforma: 'ios' }),
    ]);
    for (const r of rs) expect(r.status).toBe(201);
    expect((await tokensDe(a.id)).length + (await tokensDe(b.id)).length).toBe(1);
  });

  it('el mismo token con otra plataforma: queda uno solo y la respuesta dice la nueva', async () => {
    const u = await crearUsuario(ctx);
    const t = tokenNuevo();
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t, plataforma: 'ios' });
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    expect(r.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    expect(await tokensDe(u.id)).toEqual([t]);
  });

  it.each([
    [{ plataforma: 'android' }, /Falta el token/],
    [{ tokenExpo: 'no-es-de-expo', plataforma: 'android' }, /no tiene el formato de Expo/],
    [{ tokenExpo: 'ExponentPushToken[abc]' }, /Falta la plataforma/],
    [{ tokenExpo: 'ExponentPushToken[abc]', plataforma: 'windows' }, /android o ios/],
    [{ tokenExpo: 'ExponentPushToken[]', plataforma: 'ios' }, /formato de Expo/],
    [
      { tokenExpo: 'ExponentPushToken[abc]', plataforma: 'ios', usuarioId: 'usr-otro' },
      /No se esperaba el dato «usuarioId»/,
    ],
  ])('400 VALIDACION_FALLIDA con %j', async (cuerpo, mensaje) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toMatch(mensaje);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http.post('/dispositivos').send({ tokenExpo: tokenNuevo(), plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('Dar de baja el token: DELETE /dispositivos/:tokenExpo tiene que borrar el token del usuario', () => {
  it('204 sin cuerpo, y el token deja de estar', async () => {
    const u = await crearUsuario(ctx);
    const t = tokenNuevo();
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t, plataforma: 'ios' });
    const r = await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(u.auth)
      .expect(204);
    expect(r.text).toBe('');
    expect(await tokensDe(u.id)).toEqual([]);
  });

  it('es idempotente: un token que no está → 204', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(tokenNuevo())}`)
      .set(u.auth)
      .expect(204);
  });

  it('no borra el token de otra cuenta', async () => {
    const duenio = await crearUsuario(ctx);
    const otro = await crearUsuario(ctx);
    const t = tokenNuevo();
    await ctx.http.post('/dispositivos').set(duenio.auth).send({ tokenExpo: t, plataforma: 'ios' });
    await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(otro.auth)
      .expect(204);
    expect(await tokensDe(duenio.id)).toEqual([t]);
  });

  it('un token mal formado nunca da 500', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.delete('/dispositivos/cualquier-cosa').set(u.auth);
    expect([204, 400, 404]).toContain(r.status);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http.delete(`/dispositivos/${encodeURIComponent(tokenNuevo())}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('Buscar y descartar: lo que la API usa para avisar', () => {
  it('tokensDe devuelve los tokens de los usuarios pedidos y nada más', async () => {
    const [a, b, c] = [await crearUsuario(ctx), await crearUsuario(ctx), await crearUsuario(ctx)];
    const [ta, tb, tc] = [tokenNuevo(), tokenNuevo(), tokenNuevo()];
    for (const [u, t] of [
      [a, ta],
      [b, tb],
      [c, tc],
    ] as const) {
      await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t, plataforma: 'ios' });
    }
    expect((await tokensDe(a.id, b.id)).sort()).toEqual([ta, tb].sort());
    expect(await tokensDe()).toEqual([]);
  });

  it('descartar borra esos tokens y deja los demás', async () => {
    const u = await crearUsuario(ctx);
    const [bueno, malo] = [tokenNuevo(), tokenNuevo()];
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: bueno, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: malo, plataforma: 'ios' });
    await ctx.app.get(AlmacenTokensPush).descartar([malo]);
    expect(await tokensDe(u.id)).toEqual([bueno]);
  });
});
