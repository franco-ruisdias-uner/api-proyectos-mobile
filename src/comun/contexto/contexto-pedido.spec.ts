import { origenDelPedido } from './contexto-pedido.js';

describe('AGENTS §8 — El origen de las URLs sale del Host del pedido', () => {
  it.each([
    ['http', '192.168.0.10:3000', 'http://192.168.0.10:3000'],
    ['https', 'mi-api.onrender.com', 'https://mi-api.onrender.com'],
    ['http', '[::1]:3000', 'http://[::1]:3000'],
    ['http', 'LOCALHOST', 'http://LOCALHOST'],
  ])('%s + %s → %s', (protocol, host, esperado) => {
    expect(origenDelPedido({ protocol, host })).toBe(esperado);
  });

  it.each([['mala"<script>'], [''], ['a b'], ['host/ruta'], ['usuario@host']])(
    'Host inválido %j → null',
    (host) => {
      expect(origenDelPedido({ protocol: 'http', host })).toBeNull();
    },
  );
});
