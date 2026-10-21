import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { bearer, conSesion } from '../utilities/users.js';

const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

describe('Consigna 1 — Guardar los tokens de Expo: /dispositivos', () => {
  let c: AppDePrueba;
  beforeAll(async () => (c = await crearApp()));
  afterAll(() => c.cerrar());
  beforeEach(() => c.enviador.limpiar());

  /** A cuántos teléfonos del usuario llega una push de prueba: lo que "tiene guardado" la API. */
  const dispositivosDe = async (token: string) =>
    (await c.http().post('/dispositivos/prueba').set(bearer(token)).expect(200))
      .body.datos.dispositivos as number;

  it('POST /dispositivos registra el token: 201 con el Dispositivo', async () => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: TOKEN, plataforma: 'android' })
      .expect(201);
    esperarContrato(r.body, 'Dispositivo');
    expect(r.body.datos).toEqual({ tokenExpo: TOKEN, plataforma: 'android' });
  });

  it('es idempotente por token: dos veces → un registro', async () => {
    const u = await conSesion(c, 'lector');
    const token = 'ExponentPushToken[idempotente]';
    const a = await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    const b = await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    expect(b.body).toEqual(a.body);
    expect(await dispositivosDe(u.token)).toBe(1);
  });

  it('dos registros simultáneos del mismo token dejan uno', async () => {
    const u = await conSesion(c, 'lector');
    const token = 'ExponentPushToken[simultaneo]';
    const alta = () =>
      c
        .http()
        .post('/dispositivos')
        .set(bearer(u.token))
        .send({ tokenExpo: token, plataforma: 'android' });
    const [a, b] = await Promise.all([alta(), alta()]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(await dispositivosDe(u.token)).toBe(1);
  });

  it('teléfono compartido: si otro usuario tenía el token, pasa al actual', async () => {
    const turnoManana = await conSesion(c, 'lector');
    const turnoTarde = await conSesion(c, 'lector');
    const token = 'ExponentPushToken[compartido]';
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(turnoManana.token))
      .send({ tokenExpo: token, plataforma: 'android' })
      .expect(201);
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(turnoTarde.token))
      .send({ tokenExpo: token, plataforma: 'android' })
      .expect(201);
    expect(await dispositivosDe(turnoTarde.token)).toBe(1);

    const r = await c
      .http()
      .post('/dispositivos/prueba')
      .set(bearer(turnoManana.token))
      .expect(200);
    expect(r.body.datos).toEqual({ dispositivos: 0 });
  });

  it('POST /dispositivos/prueba manda una push a los teléfonos del usuario', async () => {
    const u = await conSesion(c, 'lector');
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: 'ExponentPushToken[prueba1]', plataforma: 'android' })
      .expect(201);
    const r = await c
      .http()
      .post('/dispositivos/prueba')
      .set(bearer(u.token))
      .expect(200);
    esperarContrato(r.body, 'PruebaPush');
    expect(r.body.datos).toEqual({ dispositivos: 1 });
    expect(c.enviador.enviados).toEqual([
      {
        tokens: ['ExponentPushToken[prueba1]'],
        titulo: 'Prueba de avisos',
        cuerpo: 'Si ves esto, las notificaciones andan.',
        datos: { tipo: 'prueba' },
      },
    ]);
  });

  it('un token que Expo da por inválido se borra', async () => {
    const u = await conSesion(c, 'lector');
    const token = 'ExponentPushToken[invalido]';
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: token, plataforma: 'ios' })
      .expect(201);
    c.enviador.invalidos.add(token);
    await c
      .http()
      .post('/dispositivos/prueba')
      .set(bearer(u.token))
      .expect(200);
    expect(await dispositivosDe(u.token)).toBe(0);
  });

  it('si Expo falla, la prueba responde igual (0) y no rompe', async () => {
    const u = await conSesion(c, 'lector');
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: 'ExponentPushToken[falla]', plataforma: 'ios' })
      .expect(201);
    c.enviador.fallar = true;
    const r = await c
      .http()
      .post('/dispositivos/prueba')
      .set(bearer(u.token))
      .expect(200);
    expect(r.body.datos).toEqual({ dispositivos: 0 });
  });

  it('DELETE /dispositivos/:tokenExpo lo da de baja: 204 sin cuerpo', async () => {
    const u = await conSesion(c, 'lector');
    const token = 'ExponentPushToken[baja]';
    await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send({ tokenExpo: token, plataforma: 'android' })
      .expect(201);
    const r = await c
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token)}`)
      .set(bearer(u.token))
      .expect(204);
    expect(r.text).toBe('');
    expect(await dispositivosDe(u.token)).toBe(0);
    await c
      .http()
      .delete(`/dispositivos/${encodeURIComponent(token)}`)
      .set(bearer(u.token))
      .expect(204);
  });

  it.each([
    [
      { tokenExpo: 'abc', plataforma: 'android' },
      'El token de notificaciones no es válido.',
    ],
    [
      { plataforma: 'android' },
      'Falta el token de notificaciones del teléfono.',
    ],
    [
      { tokenExpo: TOKEN, plataforma: 'windows' },
      'La plataforma tiene que ser "ios" o "android".',
    ],
    [
      { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-1' },
      'El dato "usuarioId" no corresponde a este pedido.',
    ],
  ])('%o → 400', async (cuerpo, mensaje) => {
    const u = await conSesion(c, 'lector');
    const r = await c
      .http()
      .post('/dispositivos')
      .set(bearer(u.token))
      .send(cuerpo)
      .expect(400);
    esperarError(r.body, 'VALIDACION_FALLIDA');
    expect(r.body.error.mensaje).toBe(mensaje);
  });

  it('DELETE con un token mal formado → 400', async () => {
    const u = await conSesion(c, 'lector');
    esperarError(
      (
        await c
          .http()
          .delete('/dispositivos/cualquiera')
          .set(bearer(u.token))
          .expect(400)
      ).body,
      'VALIDACION_FALLIDA',
    );
  });

  it.each([
    ['post', '/dispositivos'],
    ['post', '/dispositivos/prueba'],
    ['delete', `/dispositivos/${encodeURIComponent(TOKEN)}`],
  ])('%s %s sin sesión → 401', async (metodo, ruta) => {
    esperarError(
      (await c.http()[metodo as 'post' | 'delete'](ruta).expect(401)).body,
      'NO_AUTENTICADO',
    );
  });
});
