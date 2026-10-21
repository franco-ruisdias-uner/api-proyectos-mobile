// Consigna de los alumnos (docs/NOTIFICATIONS.md): mandar las push a Expo y leer su respuesta.
// Contra un servidor HTTP falso que se comporta como la API de Expo.
import { conSesion, registrarTurista } from '../utilities/builders.js';
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
import { levantarExpoFalso, type ExpoFalso } from '../utilities/fake-expo.js';

const token = (n: number) => `ExponentPushToken[tel-${String(n).padStart(6, '0')}]`;

describe('Mandar las push a Expo', () => {
  let ctx: AppDePrueba;
  let expo: ExpoFalso;
  let lucia: string;
  beforeAll(async () => {
    expo = await levantarExpoFalso();
  });
  afterAll(() => expo.cerrar());
  beforeEach(async () => {
    expo.limpiar();
    ctx = await crearApp({ reales: true, entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url } });
    lucia = (await registrarTurista(ctx)).token;
  });
  afterEach(() => ctx.cerrar());

  const registrar = (n: number) =>
    ctx
      .http()
      .post('/dispositivos')
      .set(conSesion(lucia))
      .send({ tokenExpo: token(n), plataforma: 'ios' });
  const probar = async () => {
    await ctx.http().post('/dispositivos/prueba').set(conSesion(lucia)).expect(200);
    await ctx.esperarAvisos();
  };

  describe('la forma de cada mensaje', () => {
    it('hace POST a EXPO_PUSH_URL con un arreglo JSON, un mensaje por teléfono', async () => {
      await registrar(1);
      await registrar(2);
      await probar();
      expect(expo.pedidos).toHaveLength(1);
      expect(expo.pedidos[0]).toHaveLength(2);
    });

    it('cada mensaje lleva to (el token), title, body y data, con los textos de la API', async () => {
      await registrar(1);
      await probar();
      const [m] = expo.mensajes();
      expect(m).toMatchObject({
        to: token(1),
        title: 'Mi Ciudad',
        body: '¡Las notificaciones funcionan! 🎉',
        data: { tipo: 'prueba' },
      });
    });
  });

  describe('tandas de 100 mensajes (Expo rechaza pedidos de más de 100)', () => {
    it('150 teléfonos salen en dos pedidos: 100 y 50', async () => {
      for (let i = 1; i <= 150; i++) await registrar(i).expect(201);
      await probar();
      expect(expo.pedidos.map((p) => p.length)).toEqual([100, 50]);
      expect(new Set(expo.mensajes().map((m) => m.to)).size).toBe(150);
    });
  });

  describe('DeviceNotRegistered: Expo dice que el teléfono ya no existe', () => {
    it('ese token se descarta: la próxima vez no se le manda', async () => {
      await registrar(1);
      await registrar(2);
      expo.invalidos.add(token(2));
      await probar();
      expo.limpiar();
      await probar();
      expect(expo.mensajes().map((m) => m.to)).toEqual([token(1)]);
    });

    it('los otros errores de ticket no descartan el token', async () => {
      await registrar(1);
      expo.conError.add(token(1));
      await probar();
      expo.limpiar();
      await probar();
      expect(expo.mensajes().map((m) => m.to)).toEqual([token(1)]);
    });
  });
});
