// CONSIGNA (alumnos): guardar los tokens de Expo de cada usuario.
// Todo se prueba por la API: el almacén de tokens es de ustedes y puede guardarlos como quieran
// (qué tabla, qué columnas). Para ver qué quedó guardado se usa POST /dispositivos/prueba, que
// manda una push a cada dispositivo del usuario hacia un Expo falso.
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearVecino } from '../utilities/users.js';
import type { UsuarioDePrueba } from '../utilities/users.js';

let ctx: AppDePrueba;
beforeAll(async () => {
  ctx = await crearApp({ puertosReales: true });
});
afterAll(() => ctx.cerrar());
beforeEach(() => ctx.notificador.limpiar());

let n = 0;
const token = () =>
  `ExponentPushToken[prueba-${++n}-${Math.random().toString(36).slice(2, 8)}]`;

const alta = (u: UsuarioDePrueba, cuerpo: object) =>
  ctx
    .http()
    .post('/dispositivos')
    .set(...u.auth)
    .send(cuerpo);
const baja = (u: UsuarioDePrueba, t: string) =>
  ctx
    .http()
    .delete(`/dispositivos/${encodeURIComponent(t)}`)
    .set(...u.auth);
/** Cuántos dispositivos tiene el usuario, según la push de prueba. */
async function dispositivosDe(u: UsuarioDePrueba): Promise<number> {
  const res = await ctx
    .http()
    .post('/dispositivos/prueba')
    .set(...u.auth);
  expect(res.status).toBe(200);
  await ctx.esperarAvisos();
  return res.body.datos.enviadas as number;
}

describe('Deben guardar el token: POST /dispositivos', () => {
  it('registra el token de Expo del teléfono (201) y lo devuelve tal cual', async () => {
    const v = await crearVecino(ctx);
    const t = token();
    const res = await alta(v, { tokenExpo: t, plataforma: 'android' });
    expect(res.status).toBe(201);
    esperarContrato(res, 'Dispositivo');
    expect(res.body.datos).toEqual({ tokenExpo: t, plataforma: 'android' });
    expect(await dispositivosDe(v)).toBe(1);
  });

  it('es idempotente: el mismo POST dos veces deja un solo dispositivo (201 y después 200)', async () => {
    const v = await crearVecino(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'ios' };
    const a = await alta(v, cuerpo);
    const b = await alta(v, cuerpo);
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body).toEqual(a.body);
    expect(await dispositivosDe(v)).toBe(1);
  });

  it('dos POST simultáneos con el mismo token dejan un solo dispositivo', async () => {
    const v = await crearVecino(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'ios' };
    const res = await Promise.all([alta(v, cuerpo), alta(v, cuerpo)]);
    for (const r of res) expect([200, 201]).toContain(r.status);
    expect(await dispositivosDe(v)).toBe(1);
  });

  it('si otro usuario tenía el token, pasa al usuario actual', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const t = token();
    await alta(a, { tokenExpo: t, plataforma: 'android' }).then((r) =>
      expect(r.status).toBe(201),
    );
    const res = await alta(b, { tokenExpo: t, plataforma: 'android' });
    expect(res.status).toBe(201);
    expect(await dispositivosDe(a)).toBe(0);
    expect(await dispositivosDe(b)).toBe(1);
  });

  it('el mismo token con otra plataforma no duplica y devuelve la plataforma nueva', async () => {
    const v = await crearVecino(ctx);
    const t = token();
    await alta(v, { tokenExpo: t, plataforma: 'android' });
    const res = await alta(v, { tokenExpo: t, plataforma: 'ios' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.datos.plataforma).toBe('ios');
    expect(await dispositivosDe(v)).toBe(1);
  });

  it('acepta también el formato ExpoPushToken[…]', async () => {
    const v = await crearVecino(ctx);
    const t = token().replace('ExponentPushToken', 'ExpoPushToken');
    expect((await alta(v, { tokenExpo: t, plataforma: 'ios' })).status).toBe(
      201,
    );
  });

  it('dos usuarios registran el mismo token a la vez: ninguno da 500 y queda de uno solo', async () => {
    const a = await crearVecino(ctx);
    const b = await crearVecino(ctx);
    const cuerpo = { tokenExpo: token(), plataforma: 'android' };
    const res = await Promise.all([a, b, a, b].map((u) => alta(u, cuerpo)));
    for (const r of res) expect([200, 201]).toContain(r.status);
    expect((await dispositivosDe(a)) + (await dispositivosDe(b))).toBe(1);
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
    [
      'token enorme',
      { tokenExpo: `ExponentPushToken[${'a'.repeat(600)}]`, plataforma: 'ios' },
    ],
  ])('400 con %s', async (_caso, cuerpo) => {
    const v = await crearVecino(ctx);
    esperarError(await alta(v, cuerpo), 400, 'VALIDACION_FALLIDA');
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

describe('Deben dar de baja el token: DELETE /dispositivos/:tokenExpo', () => {
  it('204 sin cuerpo y el dispositivo deja de recibir', async () => {
    const v = await crearVecino(ctx);
    const t = token();
    await alta(v, { tokenExpo: t, plataforma: 'ios' });
    const res = await baja(v, t);
    expect(res.status).toBe(204);
    expect(res.text ?? '').toBe('');
    expect(await dispositivosDe(v)).toBe(0);
  });

  it('borrar algo que ya no está también da 204 (la app puede reintentar)', async () => {
    const v = await crearVecino(ctx);
    expect((await baja(v, token())).status).toBe(204);
  });

  it('no le saca el dispositivo a otro usuario', async () => {
    const duenio = await crearVecino(ctx);
    const intruso = await crearVecino(ctx);
    const t = token();
    await alta(duenio, { tokenExpo: t, plataforma: 'ios' });
    await baja(intruso, t);
    expect(await dispositivosDe(duenio)).toBe(1);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(token())}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('Deben buscar los tokens: POST /dispositivos/prueba', () => {
  it('manda una push a cada dispositivo del usuario y a nadie más', async () => {
    const v = await crearVecino(ctx);
    const otro = await crearVecino(ctx);
    const [t1, t2, t3] = [token(), token(), token()];
    await alta(v, { tokenExpo: t1, plataforma: 'android' });
    await alta(v, { tokenExpo: t2, plataforma: 'android' });
    await alta(otro, { tokenExpo: t3, plataforma: 'ios' });
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
  });

  it('respeta el interruptor de avisos', async () => {
    const v = await crearVecino(ctx, { avisosActivos: false });
    await alta(v, { tokenExpo: token(), plataforma: 'ios' });
    const res = await ctx
      .http()
      .post('/dispositivos/prueba')
      .set(...v.auth);
    expect(res.body.datos).toEqual({ enviadas: 0 });
    await ctx.esperarAvisos();
    expect(ctx.notificador.enviadas).toHaveLength(0);
  });

  it('sin dispositivos: enviadas 0', async () => {
    expect(await dispositivosDe(await crearVecino(ctx))).toBe(0);
  });

  it('401 sin sesión', async () => {
    esperarError(
      await ctx.http().post('/dispositivos/prueba'),
      401,
      'NO_AUTENTICADO',
    );
  });
});
