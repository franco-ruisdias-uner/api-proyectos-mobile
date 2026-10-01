import { EnviadorPush } from '../../src/comun/notificaciones/puertos.js';
import { esperarContrato, esperarError } from '../utilidades/contrato.js';
import { crearUsuario } from '../utilidades/usuarios.js';
import { type AppConExpoFalso, crearAppConExpoFalso, tokenNuevo } from './expo-falso.js';
import { AlmacenTokensPush } from '../../src/comun/notificaciones/puertos.js';

// Consigna de los alumnos (parte 2): mandar las push a Expo y leer su respuesta.
// Se completa en `src/notificaciones-alumnos/`. Ver docs/NOTIFICACIONES.md.

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

const enviador = () => ctx.app.get(EnviadorPush);
const tokens = (n: number) => Array.from({ length: n }, () => tokenNuevo());

describe('Enviar: el enviador tiene que mandar a la API de Expo (EXPO_PUSH_URL) un mensaje por teléfono', () => {
  it('hace un POST con JSON y le manda a Expo { to, title, body, data } de cada teléfono', async () => {
    const [a, b] = tokens(2);
    await enviador().enviar([
      {
        tokens: [a, b],
        titulo: 'Desvío',
        cuerpo: 'Por obras',
        datos: { tipo: 'aviso', avisoId: 'avi-1' },
      },
    ]);
    expect(ctx.expo.pedidos).toHaveLength(1);
    expect(ctx.expo.contentTypes[0]).toMatch(/application\/json/);
    expect(ctx.expo.mensajes).toEqual([
      expect.objectContaining({
        to: a,
        title: 'Desvío',
        body: 'Por obras',
        data: { tipo: 'aviso', avisoId: 'avi-1' },
      }),
      expect.objectContaining({ to: b, title: 'Desvío', body: 'Por obras' }),
    ]);
  });

  it('varios mensajes en una llamada: cada uno llega a sus teléfonos con su texto', async () => {
    const [a, b] = tokens(2);
    await enviador().enviar([
      { tokens: [a], titulo: 'Uno', cuerpo: 'x', datos: {} },
      { tokens: [b], titulo: 'Dos', cuerpo: 'y', datos: {} },
    ]);
    expect(ctx.expo.mensajes.map((m) => [m.to, m.title])).toEqual([
      [a, 'Uno'],
      [b, 'Dos'],
    ]);
  });

  it('sin mensajes no llama a Expo', async () => {
    expect(await enviador().enviar([])).toEqual({ tokensInvalidos: [] });
    expect(ctx.expo.pedidos).toHaveLength(0);
  });

  it('manda en tandas de 100 mensajes como máximo (Expo no acepta más por pedido)', async () => {
    await enviador().enviar([{ tokens: tokens(250), titulo: 'Masivo', cuerpo: 'x', datos: {} }]);
    expect(ctx.expo.pedidos.map((p) => p.length)).toEqual([100, 100, 50]);
    expect(new Set(ctx.expo.mensajes.map((m) => m.to)).size).toBe(250);
  });
});

describe('Leer la respuesta: los tokens que Expo dice DeviceNotRegistered vuelven como inválidos', () => {
  it('si todo salió bien, no hay tokens inválidos', async () => {
    const r = await enviador().enviar([{ tokens: tokens(3), titulo: 'a', cuerpo: 'b', datos: {} }]);
    expect(r).toEqual({ tokensInvalidos: [] });
  });

  it('devuelve exactamente los tokens con DeviceNotRegistered', async () => {
    const [bueno, malo] = tokens(2);
    ctx.expo.noRegistrados.add(malo);
    const r = await enviador().enviar([
      { tokens: [bueno, malo], titulo: 'a', cuerpo: 'b', datos: {} },
    ]);
    expect(r).toEqual({ tokensInvalidos: [malo] });
  });

  it('también los encuentra cuando están en la segunda tanda', async () => {
    const lote = tokens(150);
    ctx.expo.noRegistrados.add(lote[120]);
    const r = await enviador().enviar([{ tokens: lote, titulo: 'a', cuerpo: 'b', datos: {} }]);
    expect(r.tokensInvalidos).toEqual([lote[120]]);
  });

  it('si Expo no responde bien (500), el enviador falla con un error (quien llama lo registra)', async () => {
    ctx.expo.caido = true;
    await expect(
      enviador().enviar([{ tokens: tokens(1), titulo: 'a', cuerpo: 'b', datos: {} }]),
    ).rejects.toThrow();
  });
});

describe('De punta a punta: POST /dispositivos/prueba usa las dos piezas juntas', () => {
  const registrar = async (u: { auth: { Authorization: string } }, t: string) =>
    ctx.http
      .post('/dispositivos')
      .set(u.auth)
      .send({ tokenExpo: t, plataforma: 'ios' })
      .expect(201);

  it('manda una push a cada teléfono de la cuenta y dice a cuántos', async () => {
    const u = await crearUsuario(ctx);
    const [t1, t2] = tokens(2);
    await registrar(u, t1);
    await registrar(u, t2);
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    esperarContrato(r.body, 'PruebaDePush');
    expect(r.body.datos).toEqual({ enviadas: 2 });
    expect(ctx.expo.destinatarios()).toEqual([t1, t2].sort());
    expect(ctx.expo.mensajes[0].title).toBe('Prueba de notificaciones');
  });

  it('sólo le llega a la cuenta que la pide', async () => {
    const a = await crearUsuario(ctx);
    const b = await crearUsuario(ctx);
    const [ta, tb] = tokens(2);
    await registrar(a, ta);
    await registrar(b, tb);
    await ctx.http.post('/dispositivos/prueba').set(a.auth).expect(200);
    expect(ctx.expo.destinatarios()).toEqual([ta]);
  });

  it('sin teléfonos registrados → enviadas 0 y no llama a Expo', async () => {
    const u = await crearUsuario(ctx);
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
    expect(ctx.expo.pedidos).toHaveLength(0);
  });

  it('respeta los avisos apagados', async () => {
    const u = await crearUsuario(ctx, { avisosActivos: false });
    await registrar(u, tokenNuevo());
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
    expect(ctx.expo.pedidos).toHaveLength(0);
  });

  it('un token que Expo marca como DeviceNotRegistered se descarta y no cuenta como enviado', async () => {
    const u = await crearUsuario(ctx);
    const [bueno, malo] = tokens(2);
    await registrar(u, bueno);
    await registrar(u, malo);
    ctx.expo.noRegistrados.add(malo);
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 1 });
    expect(await ctx.app.get(AlmacenTokensPush).tokensDe([u.id])).toEqual([bueno]);
  });

  it('si Expo está caído, la prueba responde 200 con enviadas 0 (nada se rompe)', async () => {
    const u = await crearUsuario(ctx);
    await registrar(u, tokenNuevo());
    ctx.expo.caido = true;
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
  });

  it('401 sin sesión', async () => {
    esperarError(await ctx.http.post('/dispositivos/prueba'), 401, 'NO_AUTENTICADO');
  });

  it('la prueba es en castellano, con título y cuerpo no vacíos', async () => {
    const u = await crearUsuario(ctx);
    await registrar(u, tokenNuevo());
    await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    const m = ctx.expo.mensajes[0];
    expect(m.title.trim()).not.toBe('');
    expect(m.body.trim()).not.toBe('');
  });
});
