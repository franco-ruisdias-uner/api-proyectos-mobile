import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnviadorExpo } from './expo-sender.js';

const respuesta = (data: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve({ data }),
  }) as Response;

afterEach(() => vi.unstubAllGlobals());

describe('EnviadorExpo', () => {
  it('manda un mensaje por token con su canal y devuelve los DeviceNotRegistered', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta([
        { status: 'ok', id: '1' },
        {
          status: 'error',
          message: 'x',
          details: { error: 'DeviceNotRegistered' },
        },
      ]),
    );
    vi.stubGlobal('fetch', fetchFalso);
    const r = await new EnviadorExpo('http://expo', 'secreto').enviar([
      {
        tokens: ['a', 'b'],
        titulo: 't',
        cuerpo: 'c',
        datos: { k: 'v' },
        canal: 'estado',
      },
    ]);
    expect(r.tokensInvalidos).toEqual(['b']);
    const [, init] = fetchFalso.mock.calls[0]!;
    expect(init.headers.Authorization).toBe('Bearer secreto');
    const cuerpo = JSON.parse(init.body);
    expect(cuerpo).toHaveLength(2);
    expect(cuerpo[0]).toMatchObject({
      to: 'a',
      channelId: 'estado',
      data: { k: 'v' },
    });
  });

  it('parte en lotes de 100 y no tira si Expo falla', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuesta([], false));
    vi.stubGlobal('fetch', fetchFalso);
    const tokens = Array.from({ length: 250 }, (_, i) => `t${i}`);
    const r = await new EnviadorExpo('http://expo').enviar([
      { tokens, titulo: 't', cuerpo: 'c', datos: {} },
    ]);
    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(r.tokensInvalidos).toEqual([]);
  });
});
