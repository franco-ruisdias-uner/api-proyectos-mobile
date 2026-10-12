import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EnviadorExpo } from './enviador-expo.js';

interface MensajeExpo {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
}

describe('AGENTS §19.2 — El enviador de Expo, contra un servidor falso', () => {
  let servidor: Server;
  let url: string;
  const tandas: MensajeExpo[][] = [];

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      let cuerpo = '';
      req.on('data', (c: Buffer) => (cuerpo += c.toString()));
      req.on('end', () => {
        const tanda = JSON.parse(cuerpo) as MensajeExpo[];
        tandas.push(tanda);
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            data: tanda.map((m) =>
              m.to.includes('muerto')
                ? {
                    status: 'error',
                    message: 'not registered',
                    details: { error: 'DeviceNotRegistered' },
                  }
                : { status: 'ok', id: 'ticket' },
            ),
          }),
        );
      });
    });
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  });

  afterAll(() => new Promise<void>((r) => servidor.close(() => r())));
  beforeEach(() => (tandas.length = 0));

  it('manda un mensaje por token con título, cuerpo y datos', async () => {
    const enviador = new EnviadorExpo(url);
    await enviador.enviar([
      {
        tokens: ['ExponentPushToken[a]'],
        titulo: 'Hola',
        cuerpo: 'Che',
        datos: { x: '1' },
      },
    ]);
    expect(tandas).toEqual([
      [
        {
          to: 'ExponentPushToken[a]',
          title: 'Hola',
          body: 'Che',
          data: { x: '1' },
          sound: 'default',
        },
      ],
    ]);
  });

  it('parte en tandas de 100', async () => {
    const tokens = Array.from(
      { length: 250 },
      (_, i) => `ExponentPushToken[t${i}]`,
    );
    await new EnviadorExpo(url).enviar([
      { tokens, titulo: 't', cuerpo: 'c', datos: {} },
    ]);
    expect(tandas.map((t) => t.length)).toEqual([100, 100, 50]);
  });

  it('devuelve como inválidos los DeviceNotRegistered', async () => {
    const r = await new EnviadorExpo(url).enviar([
      {
        tokens: ['ExponentPushToken[vivo]', 'ExponentPushToken[muerto]'],
        titulo: 't',
        cuerpo: 'c',
        datos: {},
      },
    ]);
    expect(r.tokensInvalidos).toEqual(['ExponentPushToken[muerto]']);
  });
});
