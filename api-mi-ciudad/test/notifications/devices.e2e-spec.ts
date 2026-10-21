// Consigna de los alumnos (docs/NOTIFICATIONS.md): guardar los tokens de Expo de cada usuario.
// Corre contra la app real, sin dobles: lo que se guarda lo ven con `POST /dispositivos/prueba`.
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { conSesion, registrarTurista } from '../utilities/builders.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { levantarExpoFalso, type ExpoFalso } from '../utilities/fake-expo.js';

const TOKEN_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const TOKEN_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

describe('Guardar los tokens: /dispositivos', () => {
  let ctx: AppDePrueba;
  let expo: ExpoFalso;
  let lucia: string;
  let pedro: string;
  beforeAll(async () => {
    expo = await levantarExpoFalso();
  });
  afterAll(() => expo.cerrar());
  beforeEach(async () => {
    expo.limpiar();
    ctx = await crearApp({ reales: true, entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url } });
    lucia = (await registrarTurista(ctx)).token;
    pedro = (await registrarTurista(ctx)).token;
  });
  afterEach(() => ctx.cerrar());

  const registrar = (token: string, tokenExpo = TOKEN_A, plataforma = 'android') =>
    ctx.http().post('/dispositivos').set(conSesion(token)).send({ tokenExpo, plataforma });
  const prueba = async (token: string) => {
    const res = await ctx.http().post('/dispositivos/prueba').set(conSesion(token)).expect(200);
    await ctx.esperarAvisos();
    return res;
  };

  describe('POST /dispositivos: registrar el teléfono (tiene que devolver 201 la primera vez)', () => {
    it('registra el teléfono: 201 con { tokenExpo, plataforma }', async () => {
      const res = await registrar(lucia).expect(201);
      esperarContrato(res.body, 'Dispositivo');
      expect(res.body.datos).toEqual({ tokenExpo: TOKEN_A, plataforma: 'android' });
    });

    it('es idempotente por token: el mismo POST dos veces deja uno y la segunda da 200', async () => {
      const primera = await registrar(lucia).expect(201);
      const segunda = await registrar(lucia).expect(200);
      expect(segunda.body).toEqual(primera.body);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 1 });
    });

    it('dos pedidos simultáneos con el mismo token dejan uno solo, sin 500', async () => {
      const respuestas = await Promise.all([registrar(lucia), registrar(lucia)]);
      expect(respuestas.every((r) => [200, 201].includes(r.status))).toBe(true);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 1 });
    });

    it('si otro usuario tenía el token, pasa al actual (200) y el anterior deja de recibir', async () => {
      await registrar(lucia).expect(201);
      await registrar(pedro, TOKEN_A, 'ios').expect(200);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 0 });
      expect((await prueba(pedro)).body.datos).toEqual({ enviadas: 1 });
    });

    it('cambiar la plataforma del mismo token: 200 con la plataforma nueva', async () => {
      await registrar(lucia, TOKEN_A, 'android').expect(201);
      const res = await registrar(lucia, TOKEN_A, 'ios').expect(200);
      expect(res.body.datos).toEqual({ tokenExpo: TOKEN_A, plataforma: 'ios' });
    });

    it('un usuario puede tener varios teléfonos', async () => {
      await registrar(lucia, TOKEN_A).expect(201);
      await registrar(lucia, TOKEN_B, 'ios').expect(201);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 2 });
    });

    it('también acepta el formato ExpoPushToken[…]', async () => {
      const res = await registrar(lucia, 'ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]');
      expect([200, 201]).toContain(res.status);
    });

    it.each([
      [{ tokenExpo: 'cualquier-cosa', plataforma: 'android' }, 'El token de notificaciones no es válido.'],
      [{ plataforma: 'android' }, 'Falta el token de notificaciones del teléfono.'],
      [{ tokenExpo: TOKEN_A, plataforma: 'windows' }, 'La plataforma tiene que ser ios o android.'],
      [{ tokenExpo: TOKEN_A }, 'La plataforma tiene que ser ios o android.'],
    ])('VALIDACION_FALLIDA: %j', async (cuerpo, mensaje) => {
      const res = await ctx.http().post('/dispositivos').set(conSesion(lucia)).send(cuerpo);
      esperarError(res, 400, 'VALIDACION_FALLIDA');
      expect(res.body.error.mensaje).toBe(mensaje);
    });

    it('un campo de más → 400', async () => {
      const res = await ctx
        .http()
        .post('/dispositivos')
        .set(conSesion(lucia))
        .send({ tokenExpo: TOKEN_A, plataforma: 'ios', modelo: 'iPhone' });
      esperarError(res, 400, 'VALIDACION_FALLIDA');
    });
  });

  describe('DELETE /dispositivos/:tokenExpo: dar de baja (204 siempre)', () => {
    const baja = (token: string, tokenExpo = TOKEN_A) =>
      ctx
        .http()
        .delete(`/dispositivos/${encodeURIComponent(tokenExpo)}`)
        .set(conSesion(token));

    it('da de baja (204 sin cuerpo) y es idempotente', async () => {
      await registrar(lucia);
      const res = await baja(lucia).expect(204);
      expect(res.text).toBe('');
      await baja(lucia).expect(204);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 0 });
    });

    it('un token que nunca existió también da 204', async () => {
      await baja(lucia, 'ExponentPushToken[nunca]').expect(204);
    });

    it('el token de otro usuario no se borra, y la respuesta no revela de quién es', async () => {
      await registrar(lucia);
      const ajeno = await baja(pedro).expect(204);
      const inexistente = await baja(pedro, 'ExponentPushToken[noexistenoexiste12345]').expect(204);
      expect(ajeno.text).toBe(inexistente.text);
      expect((await prueba(lucia)).body.datos).toEqual({ enviadas: 1 });
    });
  });

  describe('POST /dispositivos/prueba: una push a mis teléfonos y a nadie más', () => {
    it('manda a mis teléfonos y dice a cuántos', async () => {
      await registrar(lucia, TOKEN_A);
      await registrar(lucia, TOKEN_B, 'ios');
      await registrar(pedro, 'ExponentPushToken[pppppppppppppppppppppp]');
      const res = await prueba(lucia);
      esperarContrato(res.body, 'PruebaNotificacion');
      expect(res.body.datos).toEqual({ enviadas: 2 });
      expect(
        expo
          .mensajes()
          .map((m) => m.to)
          .sort(),
      ).toEqual([TOKEN_A, TOKEN_B].sort());
    });

    it('sin teléfonos registrados: enviadas 0 y no se llama a Expo', async () => {
      const res = await prueba(lucia);
      expect(res.body.datos).toEqual({ enviadas: 0 });
      expect(expo.pedidos).toHaveLength(0);
    });

    it('si Expo está caído, el pedido igual da 200', async () => {
      await registrar(lucia);
      await expo.cerrar();
      try {
        await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
        await ctx.esperarAvisos();
      } finally {
        expo = await levantarExpoFalso();
      }
    });
  });

  it('NO_AUTENTICADO sin token (los tres endpoints)', async () => {
    esperarError(
      await ctx.http().post('/dispositivos').send({ tokenExpo: TOKEN_A, plataforma: 'ios' }),
      401,
      'NO_AUTENTICADO',
    );
    esperarError(await ctx.http().post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
    esperarError(
      await ctx.http().delete(`/dispositivos/${encodeURIComponent(TOKEN_A)}`),
      401,
      'NO_AUTENTICADO',
    );
  });
});
