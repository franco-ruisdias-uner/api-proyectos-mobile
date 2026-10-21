import { Logger } from '@nestjs/common';
import { Avisos } from '../../src/common/notifications/notices.js';
import { ErrorDeApi } from '../../src/common/errors/error-api.js';
import { type AppDePrueba, crearApp } from '../utilities/create-app.js';
import { esperarContrato, esperarError } from '../utilities/contract.js';
import { crearUsuario } from '../utilities/users.js';

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

describe('AGENTS §19.2 — Avisos decide a quién y con qué texto', () => {
  it('sólo a quienes tienen los avisos activos, un mensaje con todos los teléfonos', async () => {
    const con = await crearUsuario(ctx);
    const sin = await crearUsuario(ctx, { avisosActivos: false });
    await ctx.registrarToken(con.id, 'ExponentPushToken[con-1]');
    await ctx.registrarToken(con.id, 'ExponentPushToken[con-2]');
    await ctx.registrarToken(sin.id, 'ExponentPushToken[sin-1]');
    ctx.app.get(Avisos).avisar([con.id, sin.id, con.id], { titulo: 'Aviso', cuerpo: 'Hola' });
    await ctx.esperarPush();
    expect(ctx.notificador.mensajes).toEqual([
      {
        tokens: ['ExponentPushToken[con-1]', 'ExponentPushToken[con-2]'],
        titulo: 'Aviso',
        cuerpo: 'Hola',
        datos: {},
      },
    ]);
  });

  it('los tokens que Expo informa como inválidos se descartan del almacén', async () => {
    const u = await crearUsuario(ctx);
    await ctx.registrarToken(u.id, 'ExponentPushToken[bueno]');
    await ctx.registrarToken(u.id, 'ExponentPushToken[malo]');
    ctx.notificador.invalidos.add('ExponentPushToken[malo]');
    ctx.app.get(Avisos).avisar([u.id], { titulo: 'x', cuerpo: 'y' });
    await ctx.esperarPush();
    expect(await ctx.tokens.tokensDe([u.id])).toEqual(['ExponentPushToken[bueno]']);
  });

  it('un error del enviador no rompe nada: se loguea y la prueba da 0', async () => {
    const u = await crearUsuario(ctx);
    await ctx.registrarToken(u.id, 'ExponentPushToken[uno]');
    ctx.notificador.fallar = true;
    ctx.app.get(Avisos).avisar([u.id], { titulo: 'x', cuerpo: 'y' });
    await expect(ctx.esperarPush()).resolves.toBeUndefined();
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    expect(r.body.datos).toEqual({ enviadas: 0 });
  });

  it('sin tokens no llama al enviador', async () => {
    const u = await crearUsuario(ctx);
    ctx.app.get(Avisos).avisar([u.id], { titulo: 'x', cuerpo: 'y' });
    await ctx.esperarPush();
    expect(ctx.notificador.mensajes).toEqual([]);
  });

  it('prueba: manda a los teléfonos de la cuenta y respeta los avisos apagados', async () => {
    const u = await crearUsuario(ctx);
    const apagado = await crearUsuario(ctx, { avisosActivos: false });
    await ctx.registrarToken(u.id, 'ExponentPushToken[prueba-1]');
    await ctx.registrarToken(apagado.id, 'ExponentPushToken[prueba-2]');
    const r = await ctx.http.post('/dispositivos/prueba').set(u.auth).expect(200);
    esperarContrato(r.body, 'PruebaDePush');
    expect(r.body.datos).toEqual({ enviadas: 1 });
    const r2 = await ctx.http.post('/dispositivos/prueba').set(apagado.auth).expect(200);
    expect(r2.body.datos).toEqual({ enviadas: 0 });
    expect(ctx.notificador.enviadas.map((m) => m.tokenExpo)).toEqual([
      'ExponentPushToken[prueba-1]',
    ]);
  });
});

describe('AGENTS §19.3 — una pieza sin programar (501) no rompe los flujos que avisan', () => {
  it('avisar escribe "Push pendiente de implementar" en el log y sigue', async () => {
    const u = await crearUsuario(ctx);
    const antes = ctx.tokens.tokensDe.bind(ctx.tokens);
    ctx.tokens.tokensDe = () => Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      ctx.app.get(Avisos).avisar([u.id], { titulo: 'Desvío', cuerpo: 'x' });
      await ctx.esperarPush();
      expect(log).toHaveBeenCalledWith('Push pendiente de implementar: Desvío → 1 usuarios');
    } finally {
      log.mockRestore();
      ctx.tokens.tokensDe = antes;
    }
  });

  it('la prueba, en cambio, avisa con 501 NO_IMPLEMENTADO', async () => {
    const u = await crearUsuario(ctx);
    const antes = ctx.tokens.tokensDe.bind(ctx.tokens);
    ctx.tokens.tokensDe = () => Promise.reject(new ErrorDeApi('NO_IMPLEMENTADO'));
    try {
      esperarError(await ctx.http.post('/dispositivos/prueba').set(u.auth), 501, 'NO_IMPLEMENTADO');
    } finally {
      ctx.tokens.tokensDe = antes;
    }
  });
});
