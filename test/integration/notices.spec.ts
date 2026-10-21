// El servicio Avisos con dobles en memoria de los dos puertos (AGENTS §19.2).
import { Avisos } from '../../src/common/notifications/notices.service.js';
import type {
  EnviadorPush,
  MensajePush,
} from '../../src/common/notifications/ports.js';
import {
  AlmacenTokensMemoria,
  EnviadorMemoria,
} from '../utilities/notifications.js';

const aviso = {
  titulo: 'Turno suspendido',
  cuerpo: 'Cancha anegada',
  datos: { reservaId: 'res-1180' },
};

describe('AGENTS §9 — Avisos', () => {
  it('busca los tokens de los usuarios y les manda un mensaje', async () => {
    const almacen = new AlmacenTokensMemoria();
    const enviador = new EnviadorMemoria();
    await almacen.guardar('usr-1', 'ExponentPushToken[a]', 'android');
    await almacen.guardar('usr-1', 'ExponentPushToken[b]', 'ios');
    await almacen.guardar('usr-2', 'ExponentPushToken[c]', 'ios');
    const avisos = new Avisos(almacen, enviador);
    avisos.avisar(['usr-1', 'usr-1'], aviso);
    await avisos.esperarEnvios();
    expect(enviador.enviados).toEqual<MensajePush[]>([
      { tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'], ...aviso },
    ]);
  });

  it('sin tokens no manda nada', async () => {
    const enviador = new EnviadorMemoria();
    const avisos = new Avisos(new AlmacenTokensMemoria(), enviador);
    avisos.avisar(['usr-9'], aviso);
    await avisos.esperarEnvios();
    expect(enviador.enviados).toEqual([]);
  });

  it('descarta los tokens que el enviador informa como inválidos', async () => {
    const almacen = new AlmacenTokensMemoria();
    const enviador = new EnviadorMemoria();
    enviador.invalidos = ['ExponentPushToken[viejo]'];
    await almacen.guardar('usr-1', 'ExponentPushToken[viejo]', 'android');
    await almacen.guardar('usr-1', 'ExponentPushToken[nuevo]', 'android');
    const avisos = new Avisos(almacen, enviador);
    avisos.avisar(['usr-1'], aviso);
    await avisos.esperarEnvios();
    expect(await almacen.tokensDe(['usr-1'])).toEqual([
      'ExponentPushToken[nuevo]',
    ]);
  });

  it('un error del enviador no se propaga (nunca rompe el pedido)', async () => {
    const almacen = new AlmacenTokensMemoria();
    await almacen.guardar('usr-1', 'ExponentPushToken[a]', 'android');
    const roto: EnviadorPush = {
      enviar: () => Promise.reject(new Error('Expo caído')),
    };
    const avisos = new Avisos(almacen, roto);
    expect(() => avisos.avisar(['usr-1'], aviso)).not.toThrow();
    await expect(avisos.esperarEnvios()).resolves.toBeUndefined();
  });
});

describe('AGENTS §19.3 — Avisos con las piezas de los alumnos sin programar', () => {
  it('escribe «Push pendiente de implementar» en el log y no rompe', async () => {
    const { AlmacenTokensPorHacer } =
      await import('../../src/student-notifications/todo-token-store.js');
    const { Logger } = await import('@nestjs/common');
    const aviso2 = { titulo: 'Turno suspendido', cuerpo: 'x', datos: {} };
    const avisos = new Avisos(
      new AlmacenTokensPorHacer(),
      new EnviadorMemoria(),
    );
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      avisos.avisar(['usr-1', 'usr-2'], aviso2);
      await avisos.esperarEnvios();
      expect(warn).toHaveBeenCalledWith(
        'Push pendiente de implementar: Turno suspendido → 2 usuarios',
      );
    } finally {
      warn.mockRestore();
    }
  });
});
