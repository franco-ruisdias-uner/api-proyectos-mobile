// CONSIGNA — Guardar los tokens de Expo (docs/NOTIFICATIONS.md).
// Estos tests prueban /dispositivos con la API completa y la base real, con el almacén
// de tokens que programen ustedes. El envío va a un servidor que se hace pasar por Expo.
import type { Dispositivo, PruebaDePush } from '../../contract/api.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario, registrarJugador } from '../utilities/users.js';
import { ServidorExpoFalso } from './fake-expo-server.js';

const TOKEN = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

describe('Guardar los tokens de Expo de cada usuario', () => {
  const expo = new ServidorExpoFalso();
  let a: AppDePrueba;
  beforeAll(async () => {
    await expo.iniciar();
    a = await crearApp({
      notificacionesReales: true,
      entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url },
    });
  });
  afterAll(async () => {
    await a.cerrar();
    await expo.detener();
  });
  beforeEach(() => {
    expo.noRegistrados = new Set();
  });

  const alta = (token: string, tokenExpo: string, plataforma = 'android') =>
    a
      .http()
      .post('/dispositivos')
      .set('Authorization', `Bearer ${token}`)
      .send({ tokenExpo, plataforma });

  const prueba = async (token: string) => {
    expo.vaciar();
    const res = await a
      .http()
      .post('/dispositivos/prueba')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await a.avisos.esperarEnvios();
    return esperarContrato<PruebaDePush>(res.body, 'PruebaDePush');
  };

  describe('POST /dispositivos: anotar el teléfono', () => {
    it('responde 201 con { tokenExpo, plataforma } y el teléfono queda anotado', async () => {
      const j = await registrarJugador(a);
      const res = await alta(j.token, TOKEN).expect(201);
      expect(esperarContrato<Dispositivo>(res.body, 'Dispositivo')).toEqual({
        tokenExpo: TOKEN,
        plataforma: 'android',
      });
      expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
      expect(expo.mensajes).toEqual([
        expect.objectContaining({
          to: TOKEN,
          title: 'Notificación de prueba',
        }),
      ]);
    });

    it('es idempotente: el mismo token dos veces queda una sola vez', async () => {
      const j = await registrarJugador(a);
      for (let i = 0; i < 2; i++)
        await alta(j.token, 'ExponentPushToken[idempotente]', 'ios').expect(
          201,
        );
      expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
    });

    it('si el mismo token se vuelve a anotar con otra plataforma, se queda con la nueva', async () => {
      const j = await registrarJugador(a);
      await alta(j.token, 'ExponentPushToken[cambia]', 'android').expect(201);
      const res = await alta(
        j.token,
        'ExponentPushToken[cambia]',
        'ios',
      ).expect(201);
      expect(
        esperarContrato<Dispositivo>(res.body, 'Dispositivo').plataforma,
      ).toBe('ios');
      expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
    });

    it('si otro usuario tenía el token, pasa al usuario actual', async () => {
      const uno = await registrarJugador(a);
      const otro = await registrarJugador(a);
      const token = 'ExpoPushToken[compartido]';
      await alta(uno.token, token, 'ios').expect(201);
      await alta(otro.token, token, 'ios').expect(201);
      expect(await prueba(uno.token)).toEqual({ dispositivos: 0 });
      expect(await prueba(otro.token)).toEqual({ dispositivos: 1 });
    });

    it('un usuario puede tener varios teléfonos', async () => {
      const j = await registrarJugador(a);
      await alta(j.token, 'ExponentPushToken[mio-1]').expect(201);
      await alta(j.token, 'ExponentPushToken[mio-2]', 'ios').expect(201);
      expect(await prueba(j.token)).toEqual({ dispositivos: 2 });
    });

    it('dos altas simultáneas del mismo token: las dos 201 y queda uno', async () => {
      const j = await registrarJugador(a);
      const rs = await Promise.all([
        alta(j.token, 'ExponentPushToken[simultaneo]'),
        alta(j.token, 'ExponentPushToken[simultaneo]'),
      ]);
      expect(rs.map((r) => r.status)).toEqual([201, 201]);
      expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
    });

    it('también lo puede anotar un encargado', async () => {
      const e = await crearUsuario(a, 'encargado');
      await alta(e.token, 'ExponentPushToken[encargado]', 'ios').expect(201);
    });

    it.each([
      ['token con otro formato', { tokenExpo: 'abc', plataforma: 'android' }],
      ['sin token', { plataforma: 'android' }],
      ['tokenExpo vacío', { tokenExpo: '', plataforma: 'ios' }],
      ['plataforma inválida', { tokenExpo: TOKEN, plataforma: 'windows' }],
      [
        'campo de más',
        { tokenExpo: TOKEN, plataforma: 'ios', usuarioId: 'usr-1' },
      ],
    ])('responde 400 VALIDACION_FALLIDA: %s', async (_caso, cuerpo) => {
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
  });

  describe('DELETE /dispositivos/:tokenExpo: dar de baja', () => {
    it('responde 204 sin cuerpo y ese teléfono deja de recibir', async () => {
      const j = await registrarJugador(a);
      const token = 'ExponentPushToken[borrar]';
      await alta(j.token, token).expect(201);
      const res = await a
        .http()
        .delete(`/dispositivos/${encodeURIComponent(token)}`)
        .set('Authorization', `Bearer ${j.token}`)
        .expect(204);
      expect(res.text).toBe('');
      expect(await prueba(j.token)).toEqual({ dispositivos: 0 });
      // Borrar uno que ya no está también es 204.
      await a
        .http()
        .delete(`/dispositivos/${encodeURIComponent(token)}`)
        .set('Authorization', `Bearer ${j.token}`)
        .expect(204);
    });

    it('sólo da de baja teléfonos propios: el token de otro responde 204 y no se toca', async () => {
      const duena = await registrarJugador(a);
      const intruso = await registrarJugador(a);
      const token = 'ExponentPushToken[ajeno]';
      await alta(duena.token, token, 'ios').expect(201);
      await a
        .http()
        .delete(`/dispositivos/${encodeURIComponent(token)}`)
        .set('Authorization', `Bearer ${intruso.token}`)
        .expect(204);
      expect(await prueba(duena.token)).toEqual({ dispositivos: 1 });
    });

    it('responde 400 VALIDACION_FALLIDA si el token no tiene el formato de Expo', async () => {
      const j = await registrarJugador(a);
      esperarError(
        await a
          .http()
          .delete('/dispositivos/cualquiera')
          .set('Authorization', `Bearer ${j.token}`),
        400,
        'VALIDACION_FALLIDA',
      );
    });
  });

  describe('POST /dispositivos/prueba: mandarme una push de prueba', () => {
    it('sin teléfonos anotados dice { dispositivos: 0 } y no le manda nada a Expo', async () => {
      const j = await registrarJugador(a);
      expect(await prueba(j.token)).toEqual({ dispositivos: 0 });
      expect(expo.mensajes).toEqual([]);
    });

    it('le manda un mensaje a cada teléfono propio, y a ninguno ajeno', async () => {
      const j = await registrarJugador(a);
      const otro = await registrarJugador(a);
      await alta(j.token, 'ExponentPushToken[p-1]').expect(201);
      await alta(j.token, 'ExponentPushToken[p-2]', 'ios').expect(201);
      await alta(otro.token, 'ExponentPushToken[p-ajeno]').expect(201);
      expect(await prueba(j.token)).toEqual({ dispositivos: 2 });
      expect(expo.mensajes.map((m) => m.to).sort()).toEqual([
        'ExponentPushToken[p-1]',
        'ExponentPushToken[p-2]',
      ]);
      for (const m of expo.mensajes) {
        expect(m.title.trim()).not.toBe('');
        expect(m.body.trim()).not.toBe('');
        for (const v of Object.values(m.data)) expect(typeof v).toBe('string');
      }
    });

    it('un token que Expo informa como DeviceNotRegistered se borra', async () => {
      const j = await registrarJugador(a);
      await alta(j.token, 'ExponentPushToken[invalido]').expect(201);
      await alta(j.token, 'ExponentPushToken[valido]').expect(201);
      expo.noRegistrados = new Set(['ExponentPushToken[invalido]']);
      expect(await prueba(j.token)).toEqual({ dispositivos: 2 });
      expo.noRegistrados = new Set();
      expect(await prueba(j.token)).toEqual({ dispositivos: 1 });
      expect(expo.mensajes.map((m) => m.to)).toEqual([
        'ExponentPushToken[valido]',
      ]);
    });
  });

  it('los tres endpoints piden sesión: 401 NO_AUTENTICADO', async () => {
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
