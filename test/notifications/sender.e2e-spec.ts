// CONSIGNA (alumnos): mandar las push a Expo y leer su respuesta.
// El servidor de Expo es falso (test/utilities/notificaciones.ts): no se sale a internet.
import { crearApp, type AppDePrueba } from '../utilities/create-app.js';
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
  `ExponentPushToken[envio-${++n}-${Math.random().toString(36).slice(2, 8)}]`;

async function conDispositivos(cuantos: number) {
  const v = await crearVecino(ctx);
  const tokens: string[] = [];
  for (let i = 0; i < cuantos; i++) {
    const t = token();
    tokens.push(t);
    await ctx
      .http()
      .post('/dispositivos')
      .set(...v.auth)
      .send({ tokenExpo: t, plataforma: 'android' })
      .expect(201);
  }
  return { v, tokens };
}
const probar = async (v: UsuarioDePrueba) => {
  const res = await ctx
    .http()
    .post('/dispositivos/prueba')
    .set(...v.auth);
  await ctx.esperarAvisos();
  return res;
};

describe('El enviador debe mandar cada mensaje con la forma que pide Expo', () => {
  it('un mensaje por dispositivo, con to, title, body y data (texto en castellano)', async () => {
    const { v, tokens } = await conDispositivos(2);
    await probar(v);
    const expo = ctx.expo!;
    expect(expo.pedidos).toHaveLength(1);
    const mensajes = expo.pedidos[0]!;
    expect(mensajes.map((m) => m.to).sort()).toEqual([...tokens].sort());
    for (const m of mensajes) {
      expect(m.title.trim()).not.toBe('');
      expect(m.body.trim()).not.toBe('');
      expect(m.data).toEqual({ tipo: 'prueba' });
    }
  });

  it('manda a Expo con POST y JSON', async () => {
    const { v } = await conDispositivos(1);
    await probar(v);
    expect(ctx.expo!.pedidos).toHaveLength(1);
  });
});

describe('El enviador debe mandar en tandas de 100 mensajes', () => {
  it('250 dispositivos → tres pedidos a Expo de 100, 100 y 50', async () => {
    const { v } = await conDispositivos(250);
    const res = await probar(v);
    expect(res.body.datos).toEqual({ enviadas: 250 });
    expect(ctx.expo!.pedidos.map((p) => p.length)).toEqual([100, 100, 50]);
  }, 60_000);
});

describe('El enviador debe leer la respuesta de Expo', () => {
  it('DeviceNotRegistered → el token se descarta y no se vuelve a usar', async () => {
    const { v, tokens } = await conDispositivos(2);
    const [bueno, malo] = tokens as [string, string];
    ctx.notificador.marcarInvalido(malo);
    await probar(v);
    ctx.notificador.limpiar();
    ctx.notificador.marcarInvalido(malo);
    const segunda = await probar(v);
    expect(segunda.body.datos).toEqual({ enviadas: 1 });
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo)).toEqual([bueno]);
  });

  it('si Expo falla (500), el pedido de la API no se rompe y los tokens se conservan', async () => {
    const { v } = await conDispositivos(1);
    ctx.notificador.fallarProximoEnvio();
    const res = await probar(v);
    expect(res.status).toBe(200);
    const otra = await probar(v);
    expect(otra.body.datos).toEqual({ enviadas: 1 });
    expect(ctx.notificador.enviadas).toHaveLength(1);
  });
});
