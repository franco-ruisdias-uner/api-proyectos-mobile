import { AlmacenTokensMemoria } from '../../../test/utilities/in-memory-token-store.js';
import { EnviadorMemoria } from '../../../test/utilities/in-memory-sender.js';
import { AvisosServicio } from './notices.service.js';
import { PendienteDeImplementar, type EnviadorPush } from './ports.js';

const aviso = { titulo: 'Evento cancelado', cuerpo: 'Se canceló «Peña».', datos: { tipo: 'evento-estado' } };

describe('AGENTS §19.2 — Avisos decide a quién se avisa', () => {
  it('manda un solo mensaje con los tokens de los usuarios pedidos, sin repetir usuarios', async () => {
    const almacen = new AlmacenTokensMemoria();
    const enviador = new EnviadorMemoria();
    await almacen.guardar('usr-1', 't1', 'ios');
    await almacen.guardar('usr-2', 't2', 'android');
    await almacen.guardar('usr-3', 't3', 'android');
    const avisos = new AvisosServicio(almacen, enviador);
    avisos.avisar(['usr-1', 'usr-2', 'usr-1'], aviso);
    await avisos.esperarPendientes();
    expect(enviador.enviadas).toEqual([{ tokens: ['t1', 't2'], ...aviso }]);
  });

  it('sin tokens no llama al enviador', async () => {
    const enviador = new EnviadorMemoria();
    const avisos = new AvisosServicio(new AlmacenTokensMemoria(), enviador);
    avisos.avisar(['usr-1'], aviso);
    avisos.avisar([], aviso);
    await avisos.esperarPendientes();
    expect(enviador.enviadas).toEqual([]);
  });

  it('descarta los tokens que el enviador informa como inválidos', async () => {
    const almacen = new AlmacenTokensMemoria();
    const enviador = new EnviadorMemoria();
    await almacen.guardar('usr-1', 't1', 'ios');
    await almacen.guardar('usr-1', 't2', 'ios');
    enviador.invalidos.add('t2');
    const avisos = new AvisosServicio(almacen, enviador);
    avisos.avisar(['usr-1'], aviso);
    await avisos.esperarPendientes();
    expect(almacen.todos()).toEqual(['t1']);
  });

  it('un error del enviador no se propaga', async () => {
    const almacen = new AlmacenTokensMemoria();
    await almacen.guardar('usr-1', 't1', 'ios');
    const roto: EnviadorPush = { enviar: () => Promise.reject(new Error('Expo caído')) };
    const avisos = new AvisosServicio(almacen, roto);
    avisos.avisar(['usr-1'], aviso);
    await expect(avisos.esperarPendientes()).resolves.toBeUndefined();
  });

  it('con las piezas sin implementar sigue de largo (no rompe el flujo)', async () => {
    const pendiente = () => Promise.reject(new PendienteDeImplementar('tokens'));
    const avisos = new AvisosServicio(
      { guardar: pendiente, borrar: pendiente, tokensDe: pendiente, descartar: pendiente },
      { enviar: pendiente },
    );
    avisos.avisar(['usr-1'], aviso);
    await expect(avisos.esperarPendientes()).resolves.toBeUndefined();
  });
});
