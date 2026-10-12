import {
  AlmacenTokensMemoria,
  EnviadorMemoria,
} from '../../../test/utilidades/notificaciones-memoria.js';
import { Avisos } from './avisos.js';

describe('AGENTS §19.2 — Avisos decide a quién y qué; los puertos guardan y mandan', () => {
  let almacen: AlmacenTokensMemoria;
  let enviador: EnviadorMemoria;
  let avisos: Avisos;

  beforeEach(async () => {
    almacen = new AlmacenTokensMemoria();
    enviador = new EnviadorMemoria();
    avisos = new Avisos(almacen, enviador);
    await almacen.guardar('usr-1', 'ExponentPushToken[uno]', 'android');
    await almacen.guardar('usr-1', 'ExponentPushToken[dos]', 'ios');
    await almacen.guardar('usr-2', 'ExponentPushToken[tres]', 'android');
  });

  it('manda un mensaje con los tokens de los destinatarios', async () => {
    avisos.avisar(['usr-1'], {
      titulo: 'Ruta nueva',
      cuerpo: 'Tenés una ruta nueva.',
      datos: { rutaId: 'rut-07-2026-05' },
    });
    await avisos.esperarPendientes();
    expect(enviador.enviados).toEqual([
      {
        tokens: ['ExponentPushToken[dos]', 'ExponentPushToken[uno]'],
        titulo: 'Ruta nueva',
        cuerpo: 'Tenés una ruta nueva.',
        datos: { rutaId: 'rut-07-2026-05' },
      },
    ]);
  });

  it('sin tokens no manda nada', async () => {
    expect(
      await avisos.enviarAhora(['usr-9'], { titulo: 't', cuerpo: 'c' }),
    ).toBe(0);
    expect(enviador.enviados).toEqual([]);
  });

  it('descarta los tokens que Expo dice que ya no existen', async () => {
    enviador.invalidos.add('ExponentPushToken[uno]');
    await avisos.enviarAhora(['usr-1'], { titulo: 't', cuerpo: 'c' });
    expect(await almacen.tokensDe(['usr-1'])).toEqual([
      'ExponentPushToken[dos]',
    ]);
  });

  it('un error del enviador no se propaga', async () => {
    enviador.fallar = true;
    avisos.avisar(['usr-1'], { titulo: 't', cuerpo: 'c' });
    await expect(avisos.esperarPendientes()).resolves.toBeUndefined();
    expect(
      await avisos.enviarAhora(['usr-1'], { titulo: 't', cuerpo: 'c' }),
    ).toBe(0);
  });
});
