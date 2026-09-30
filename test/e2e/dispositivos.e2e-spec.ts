import { DispositivoEntidad } from '../../src/modulos/dispositivos/dispositivo.entidad.js';
import { DispositivosServicio } from '../../src/modulos/dispositivos/dispositivos.servicio.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario } from '../utilidades/usuarios.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp();
});
afterAll(() => ctx.cerrar());
beforeEach(() => {
  ctx.notificador.vaciar();
  ctx.notificador.invalidos.clear();
  ctx.notificador.fallar = false;
});

let n = 0;
const token = () => `ExponentPushToken[prueba-${++n}-${Math.random().toString(36).slice(2, 10)}]`;
const dispositivos = () => ctx.dataSource.getRepository(DispositivoEntidad);

describe('AGENTS §9 — POST /dispositivos', () => {
  it('registra el token del teléfono', async () => {
    const u = await crearUsuario(ctx);
    const t = token();
    const r = await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    esperarContrato(r.body, 'Dispositivo');
    expect(r.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    expect(await dispositivos().findOneBy({ tokenExpo: t })).toMatchObject({ usuarioId: u.id });
  });

  it('acepta también el formato ExpoPushToken[…]', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: 'ExpoPushToken[abcdef123]', plataforma: 'ios' })
      .expect(201);
  });

  it('es idempotente: el mismo token dos veces deja un solo registro y la misma respuesta', async () => {
    const u = await crearUsuario(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'ios' };
    const a = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo).expect(201);
    const b = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo).expect(201);
    expect(b.body).toEqual(a.body);
    expect(await dispositivos().countBy({ tokenExpo: cuerpo.tokenExpo })).toBe(1);
  });

  it('dos registros simultáneos del mismo token dejan uno solo', async () => {
    const u = await crearUsuario(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'android' };
    const rs = await Promise.all([
      ctx.http.post('/dispositivos').set(u.auth).send(cuerpo),
      ctx.http.post('/dispositivos').set(u.auth).send(cuerpo),
    ]);
    expect(rs.map((r) => r.status)).toEqual([201, 201]);
    expect(await dispositivos().countBy({ tokenExpo: cuerpo.tokenExpo })).toBe(1);
  });

  it('si otro usuario tenía el token, pasa al actual', async () => {
    const antes = await crearUsuario(ctx);
    const ahora = await crearUsuario(ctx);
    const t = token();
    await ctx.http
      .post('/dispositivos')
      .set(antes.auth)
      .send({ tokenExpo: t, plataforma: 'android' });
    await ctx.http
      .post('/dispositivos')
      .set(ahora.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
    expect(await dispositivos().findBy({ tokenExpo: t })).toEqual([
      expect.objectContaining({ usuarioId: ahora.id }),
    ]);
  });

  it.each([
    [{ plataforma: 'android' }, /Falta el token/],
    [{ tokenExpo: 'no-es-de-expo', plataforma: 'android' }, /no tiene el formato de Expo/],
    [{ tokenExpo: 'ExponentPushToken[abc]' }, /Falta la plataforma/],
    [{ tokenExpo: 'ExponentPushToken[abc]', plataforma: 'windows' }, /android o ios/],
    [
      { tokenExpo: 'ExponentPushToken[abc]', plataforma: 'ios', usuarioId: 'usr-otro' },
      /No se esperaba el dato «usuarioId»/,
    ],
  ])('400 VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/dispositivos').set(u.auth).send(cuerpo);
    esperarError(r, 400, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toMatch(mensaje);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http.post('/dispositivos').send({ tokenExpo: token(), plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §9 — DELETE /dispositivos/:tokenExpo', () => {
  it('da de baja: 204 sin cuerpo', async () => {
    const u = await crearUsuario(ctx);
    const t = token();
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t, plataforma: 'ios' });
    const r = await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(u.auth)
      .expect(204);
    expect(r.text).toBe('');
    expect(await dispositivos().countBy({ tokenExpo: t })).toBe(0);
  });

  it('es idempotente: un token que no está → 204', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(token())}`)
      .set(u.auth)
      .expect(204);
  });

  it('no borra el token de otra cuenta', async () => {
    const duenio = await crearUsuario(ctx);
    const otro = await crearUsuario(ctx);
    const t = token();
    await ctx.http.post('/dispositivos').set(duenio.auth).send({ tokenExpo: t, plataforma: 'ios' });
    await ctx.http
      .delete(`/dispositivos/${encodeURIComponent(t)}`)
      .set(otro.auth)
      .expect(204);
    expect(await dispositivos().countBy({ tokenExpo: t })).toBe(1);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http.delete(`/dispositivos/${encodeURIComponent(token())}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §9 — POST /dispositivos/prueba', () => {
  it('manda una push a cada teléfono de la cuenta', async () => {
    const u = await crearUsuario(ctx);
    const [t1, t2] = [token(), token()];
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t1, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: t2, plataforma: 'android' });
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    esperarContrato(r.body, 'PruebaDePush');
    expect(r.body.datos).toEqual({ enviadas: 2 });
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo).sort()).toEqual([t1, t2].sort());
    expect(ctx.notificador.enviadas[0].titulo).toBe('Prueba de notificaciones');
  });

  it('sin teléfonos registrados → enviadas 0', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('respeta los avisos apagados', async () => {
    const u = await crearUsuario(ctx, { avisosActivos: false });
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: token(), plataforma: 'ios' });
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
    expect(ctx.notificador.enviadas).toEqual([]);
  });

  it('401 sin sesión', async () => {
    esperarError(await ctx.http.post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
  });
});

describe('AGENTS §9 — notificar desde el servidor', () => {
  it('sólo a quienes tienen los avisos activos, y sin bloquear', async () => {
    const con = await crearUsuario(ctx);
    const sin = await crearUsuario(ctx, { avisosActivos: false });
    const [tCon, tSin] = [token(), token()];
    await ctx.http.post('/dispositivos').set(con.auth).send({ tokenExpo: tCon, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(sin.auth).send({ tokenExpo: tSin, plataforma: 'ios' });

    ctx.app
      .get(DispositivosServicio)
      .notificar([con.id, sin.id], { titulo: 'Aviso', cuerpo: 'Hola' });
    await ctx.esperarPush();
    expect(ctx.notificador.enviadas).toEqual([
      { tokenExpo: tCon, titulo: 'Aviso', cuerpo: 'Hola', datos: undefined },
    ]);
  });

  it('los tokens que Expo informa como inválidos se borran', async () => {
    const u = await crearUsuario(ctx);
    const [bueno, malo] = [token(), token()];
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: bueno, plataforma: 'ios' });
    await ctx.http.post('/dispositivos').set(u.auth).send({ tokenExpo: malo, plataforma: 'ios' });
    ctx.notificador.invalidos.add(malo);
    ctx.app.get(DispositivosServicio).notificar([u.id], { titulo: 'x', cuerpo: 'y' });
    await ctx.esperarPush();
    expect(await dispositivos().countBy({ tokenExpo: malo })).toBe(0);
    expect(await dispositivos().countBy({ tokenExpo: bueno })).toBe(1);
  });

  it('un error de Expo no rompe nada', async () => {
    const u = await crearUsuario(ctx);
    await ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: token(), plataforma: 'ios' });
    ctx.notificador.fallar = true;
    ctx.app.get(DispositivosServicio).notificar([u.id], { titulo: 'x', cuerpo: 'y' });
    await expect(ctx.esperarPush()).resolves.toBeUndefined();
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos.enviadas).toBe(0);
  });
});
