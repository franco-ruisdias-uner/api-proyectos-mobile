// El enviador de Expo contra un servidor HTTP falso (AGENTS §19.2): no sale a internet.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EnviadorExpo } from '../../src/comun/notificaciones/enviador-expo.js';

interface MensajeRecibido {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

describe('AGENTS §9 — EnviadorExpo', () => {
  let servidor: Server;
  let url: string;
  const tandas: MensajeRecibido[][] = [];
  let noRegistrados = new Set<string>();

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c: Buffer) => (cuerpo += c.toString()));
      req.on('end', () => {
        const tanda = JSON.parse(cuerpo) as MensajeRecibido[];
        tandas.push(tanda);
        const data = tanda.map((m) =>
          noRegistrados.has(m.to)
            ? {
                status: 'error',
                message: 'not registered',
                details: { error: 'DeviceNotRegistered' },
              }
            : { status: 'ok', id: `ticket-${m.to}` },
        );
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ data }));
      });
    });
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  });
  afterAll(() => new Promise<void>((r) => servidor.close(() => r())));
  beforeEach(() => {
    tandas.length = 0;
    noRegistrados = new Set();
  });

  it('manda un mensaje por token con título, cuerpo y datos', async () => {
    const r = await new EnviadorExpo(url).enviar([
      {
        tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
        titulo: 'Turno liberado',
        cuerpo: 'Cancha 2, 21 h',
        datos: { espacioId: 'esp-02' },
      },
    ]);
    expect(r.tokensInvalidos).toEqual([]);
    expect(tandas).toHaveLength(1);
    expect(tandas[0]).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[a]',
        title: 'Turno liberado',
        body: 'Cancha 2, 21 h',
        data: { espacioId: 'esp-02' },
      }),
      expect.objectContaining({ to: 'ExponentPushToken[b]' }),
    ]);
  });

  it('en tandas de 100 como mucho', async () => {
    const tokens = Array.from(
      { length: 250 },
      (_, i) => `ExponentPushToken[t${i}]`,
    );
    await new EnviadorExpo(url).enviar([
      { tokens, titulo: 't', cuerpo: 'c', datos: {} },
    ]);
    expect(tandas.map((t) => t.length)).toEqual([100, 100, 50]);
  });

  it('DeviceNotRegistered → el token vuelve como inválido', async () => {
    noRegistrados = new Set(['ExponentPushToken[viejo]']);
    const r = await new EnviadorExpo(url).enviar([
      {
        tokens: ['ExponentPushToken[nuevo]', 'ExponentPushToken[viejo]'],
        titulo: 't',
        cuerpo: 'c',
        datos: {},
      },
    ]);
    expect(r.tokensInvalidos).toEqual(['ExponentPushToken[viejo]']);
  });
});
