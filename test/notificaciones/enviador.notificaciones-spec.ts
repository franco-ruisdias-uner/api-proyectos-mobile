// CONSIGNA — Enviar las push a Expo (docs/NOTIFICACIONES.md).
// Estos tests le piden al enviador que programen ustedes (el `EnviadorPush` de la app)
// que mande mensajes a un servidor que se hace pasar por Expo y lea su respuesta.
import { EnviadorPush } from '../../src/comun/notificaciones/puertos.js';
import { type AppDePrueba, crearApp } from '../utilidades/crear-app.js';
import { ServidorExpoFalso } from './servidor-expo-falso.js';

describe('Enviar las push a la API de Expo', () => {
  const expo = new ServidorExpoFalso();
  let a: AppDePrueba;
  let enviador: EnviadorPush;
  beforeAll(async () => {
    await expo.iniciar();
    a = await crearApp({
      notificacionesReales: true,
      entorno: { NOTIFICACIONES: 'expo', EXPO_PUSH_URL: expo.url },
    });
    enviador = a.app.get(EnviadorPush);
  });
  afterAll(async () => {
    await a.cerrar();
    await expo.detener();
  });
  beforeEach(() => {
    expo.vaciar();
    expo.noRegistrados = new Set();
  });

  it('manda un mensaje por token, con título, cuerpo y datos', async () => {
    const r = await enviador.enviar([
      {
        tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
        titulo: 'Turno liberado',
        cuerpo: 'Cancha 2, 21 h',
        datos: { espacioId: 'esp-02' },
      },
    ]);
    expect(r.tokensInvalidos).toEqual([]);
    expect(expo.tandas).toHaveLength(1);
    expect(expo.tandas[0]).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[a]',
        title: 'Turno liberado',
        body: 'Cancha 2, 21 h',
        data: { espacioId: 'esp-02' },
      }),
      expect.objectContaining({ to: 'ExponentPushToken[b]' }),
    ]);
  });

  it('junta varios mensajes en el mismo envío, cada uno con su texto', async () => {
    await enviador.enviar([
      {
        tokens: ['ExponentPushToken[a]'],
        titulo: 'Uno',
        cuerpo: 'c1',
        datos: {},
      },
      {
        tokens: ['ExponentPushToken[b]'],
        titulo: 'Dos',
        cuerpo: 'c2',
        datos: {},
      },
    ]);
    expect(expo.mensajes.map((m) => [m.to, m.title])).toEqual([
      ['ExponentPushToken[a]', 'Uno'],
      ['ExponentPushToken[b]', 'Dos'],
    ]);
  });

  it('Expo acepta hasta 100 mensajes por pedido: 250 tokens van en tandas de 100, 100 y 50', async () => {
    const tokens = Array.from(
      { length: 250 },
      (_, i) => `ExponentPushToken[t${i}]`,
    );
    await enviador.enviar([{ tokens, titulo: 't', cuerpo: 'c', datos: {} }]);
    expect(expo.tandas.map((t) => t.length)).toEqual([100, 100, 50]);
  });

  it('sin mensajes no le pega a Expo', async () => {
    expect(await enviador.enviar([])).toEqual({ tokensInvalidos: [] });
    expect(expo.tandas).toEqual([]);
  });

  it('un ticket con DeviceNotRegistered devuelve ese token como inválido', async () => {
    expo.noRegistrados = new Set(['ExponentPushToken[viejo]']);
    const r = await enviador.enviar([
      {
        tokens: ['ExponentPushToken[nuevo]', 'ExponentPushToken[viejo]'],
        titulo: 't',
        cuerpo: 'c',
        datos: {},
      },
    ]);
    expect(r.tokensInvalidos).toEqual(['ExponentPushToken[viejo]']);
  });

  it('los tickets se leen en el orden de los mensajes, también pasando de una tanda a otra', async () => {
    const tokens = Array.from(
      { length: 150 },
      (_, i) => `ExponentPushToken[o${i}]`,
    );
    expo.noRegistrados = new Set([tokens[3], tokens[120]]);
    const r = await enviador.enviar([
      { tokens, titulo: 't', cuerpo: 'c', datos: {} },
    ]);
    expect([...r.tokensInvalidos].sort()).toEqual(
      [tokens[3], tokens[120]].sort(),
    );
  });
});
