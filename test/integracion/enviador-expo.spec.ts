import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { EnviadorExpo } from '../../src/comun/notificaciones/enviador-expo.js';

interface PedidoRecibido {
  cabeceras: IncomingMessage['headers'];
  cuerpo: {
    to: string;
    title: string;
    body: string;
    data: Record<string, string>;
    sound: string;
  }[];
}

/** Servidor HTTP que hace de API de push de Expo (AGENTS §19.2): no sale a internet. */
describe('AGENTS §9 / §19.2 — EnviadorExpo contra un servidor falso de Expo', () => {
  let servidor: Server;
  let url: string;
  let pedidos: PedidoRecibido[];
  let noRegistrados: Set<string>;
  let estado: number;

  beforeAll(async () => {
    servidor = createServer((req, res) => {
      let texto = '';
      req.on('data', (c: Buffer) => (texto += c.toString()));
      req.on('end', () => {
        const cuerpo = JSON.parse(texto) as PedidoRecibido['cuerpo'];
        pedidos.push({ cabeceras: req.headers, cuerpo });
        res.statusCode = estado;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            data: cuerpo.map((m) =>
              noRegistrados.has(m.to)
                ? {
                    status: 'error',
                    message: 'no registrado',
                    details: { error: 'DeviceNotRegistered' },
                  }
                : { status: 'ok', id: 'XXXX' },
            ),
          }),
        );
      });
    });
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/--/api/v2/push/send`;
  });
  afterAll(() => new Promise<void>((r) => servidor.close(() => r())));
  beforeEach(() => {
    pedidos = [];
    noRegistrados = new Set();
    estado = 200;
  });

  const token = (i: number) => `ExponentPushToken[${String(i).padStart(22, '0')}]`;

  it('manda un mensaje por token con título, cuerpo, datos y sonido, como JSON', async () => {
    const enviador = new EnviadorExpo(url);
    const r = await enviador.enviar([
      {
        tokens: [token(1), token(2)],
        titulo: 'Promo nueva',
        cuerpo: '15% en pinturas',
        datos: { promocionId: 'pro-441' },
      },
    ]);
    expect(r).toEqual({ tokensInvalidos: [] });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].cabeceras['content-type']).toBe('application/json');
    expect(pedidos[0].cuerpo).toEqual([
      {
        to: token(1),
        title: 'Promo nueva',
        body: '15% en pinturas',
        data: { promocionId: 'pro-441' },
        sound: 'default',
      },
      {
        to: token(2),
        title: 'Promo nueva',
        body: '15% en pinturas',
        data: { promocionId: 'pro-441' },
        sound: 'default',
      },
    ]);
  });

  it('en tandas de 100 mensajes', async () => {
    const tokens = Array.from({ length: 250 }, (_, i) => token(i));
    await new EnviadorExpo(url).enviar([{ tokens, titulo: 't', cuerpo: 'c', datos: {} }]);
    expect(pedidos.map((p) => p.cuerpo.length)).toEqual([100, 100, 50]);
    expect(pedidos.flatMap((p) => p.cuerpo.map((m) => m.to))).toEqual(tokens);
  });

  it('DeviceNotRegistered → el token vuelve como inválido (también en la segunda tanda)', async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => token(i));
    noRegistrados.add(token(3));
    noRegistrados.add(token(120));
    const r = await new EnviadorExpo(url).enviar([{ tokens, titulo: 't', cuerpo: 'c', datos: {} }]);
    expect(r.tokensInvalidos).toEqual([token(3), token(120)]);
  });

  it('si Expo responde un error HTTP, no tira: no hay tokens inválidos', async () => {
    estado = 500;
    const r = await new EnviadorExpo(url).enviar([
      { tokens: [token(1)], titulo: 't', cuerpo: 'c', datos: {} },
    ]);
    expect(r).toEqual({ tokensInvalidos: [] });
  });

  it('sin mensajes no llama a Expo', async () => {
    await new EnviadorExpo(url).enviar([]);
    expect(pedidos).toEqual([]);
  });
});
