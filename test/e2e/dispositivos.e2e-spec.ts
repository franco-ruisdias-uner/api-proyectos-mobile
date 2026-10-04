// AGENTS §9: /dispositivos registra el token de Expo del teléfono.
import type { Dispositivo, PruebaDePush } from '../../contrato/api.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { registrarJugador } from '../utilidades/usuarios.js';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('/dispositivos — AGENTS §9', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  const prueba = async (token: string) => {
    a.enviador.vaciar();
    const res = await a
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await a.avisos.esperarEnvios();
    return esperarContrato<PruebaDePush>(res.body, 'PruebaDePush');
  };

  it('POST 201 con el dispositivo, y la prueba le llega', async () => {
    const j = await registrarJugador(a);
    const res = await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${j.token}`)
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    expect(esperarContrato<Dispositivo>(res.body, 'Dispositivo')).toEqual({
      tokenExpo: TOKEN,
      plataforma: 'android',
    });
    expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
    expect(a.enviador.enviados).toEqual([
      expect.objectContaining({
        tokens: [TOKEN],
        titulo: 'Notificación de prueba',
      }),
    ]);
  });

  it('idempotente: el mismo token dos veces queda una vez', async () => {
    const j = await registrarJugador(a);
    const token = 'ExponentPushToken[idempotente]';
    for (let i = 0; i < 2; i++) {
      await a
        .http()
        .post('/dispositivos')
        .set('Authorization', `Bearer ${j.token}`)
        .send({ tokenExpo: token, plataforma: 'ios' })
        .expect(201);
    }
    expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
  });

  it('si otro usuario tenía el token, pasa al actual', async () => {
    const uno = await registrarJugador(a);
    const otro = await registrarJugador(a);
    const token = 'ExpoPushToken[compartido]';
    await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${uno.token}`)
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${otro.token}`)
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    expect(await prueba(uno.token)).toEqual({ dispositivos: 0 });
    expect(await prueba(otro.token)).toEqual({ dispositivos: 1 });
  });

  it('DELETE 204 sin cuerpo y deja de recibir', async () => {
    const j = await registrarJugador(a);
    const token = 'ExponentPushToken[borrar]';
    await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${j.token}`)
      .send({ tokenExpo: token, plataforma: 'android' })
      .expect(201);
    const res = await a
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token)}`)
      .set('Authorization', `Bearer ${j.token}`)
      .expect(204);
    expect(res.text).toBe('');
    expect(await prueba(j.token)).toEqual({ dispositivos: 0 });
    // Borrar uno que ya no está: también 204.
    await a
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token)}`)
      .set('Authorization', `Bearer ${j.token}`)
      .expect(204);
  });

  it.each([
    ['token con otro formato', { tokenExpo: 'abc', plataforma: 'android' }],
    ['sin token', { plataforma: 'android' }],
    ['plataforma inválida', { tokenExpo: TOKEN, plataforma: 'windows' }],
    [
      'campo de más',
      { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-1' },
    ],
  ])('VALIDACION_FALLIDA (400): %s', async (_caso, cuerpo) => {
    const j = await registrarJugador(a);
    esperarError(
      await a
        .http()
        .post('/dispositivos')
        .set('Authorization', `Bearer ${j.token}`)
        .send(cuerpo),
      400,
      'VALIDACION_FALLIDA',
    );
  });

  it('NO_AUTENTICADO (401) en los tres endpoints', async () => {
    esperarError(
      await a
        .http()
        .post('/dispositivos')
        .send({ tokenExpo: TOKEN, plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await a.http().post('/dispositivos/prueba'),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(
      await a.http().delete(`/dispositivos/${encodeURIComponent(TOKEN)}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});

describe('AGENTS §7.3 — Sólo el dueño da de baja su dispositivo', () => {
  let a: AppDePrueba;
  beforeAll(async () => {
    a = await crearApp();
  });
  afterAll(() => a.cerrar());

  it('el DELETE de un token ajeno responde 204 y no lo borra', async () => {
    const duena = await registrarJugador(a);
    const otro = await registrarJugador(a);
    const token = 'ExponentPushToken[ajeno]';
    await a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${duena.token}`)
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    await a
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token)}`)
      .set('Authorization', `Bearer ${otro.token}`)
      .expect(204);
    const res = await a
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', `Bearer ${duena.token}`)
      .expect(200);
    expect(esperarContrato<PruebaDePush>(res.body, 'PruebaDePush')).toEqual({
      dispositivos: 1,
    });
  });
});
