import { siguienteOrden } from './favorite-order.js';

describe('Espec. R16 — el orden de los favoritos es el de alta', () => {
  it.each([
    [[], 0],
    [[0], 1],
    [[0, 1, 2], 3],
    [[0, 2], 3],
    [[5, 1], 6],
  ])('siguienteOrden(%j) = %i', (existentes, esperado) => {
    expect(siguienteOrden(existentes)).toBe(esperado);
  });
});
