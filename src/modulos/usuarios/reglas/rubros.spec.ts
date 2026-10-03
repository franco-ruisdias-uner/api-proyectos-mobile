import { rubrosInexistentes, sinRepetidos } from './rubros.js';

describe('R17 — Rubros de interés: reglas puras', () => {
  it.each([
    [[], []],
    [
      ['a', 'b'],
      ['a', 'b'],
    ],
    [
      ['b', 'a', 'b', 'a'],
      ['b', 'a'],
    ],
  ])('sinRepetidos(%j) conserva el orden', (entrada, salida) => {
    expect(sinRepetidos(entrada)).toEqual(salida);
  });

  it.each([
    [[], ['a'], []],
    [['a', 'x'], ['a', 'b'], ['x']],
    [['x', 'y'], [], ['x', 'y']],
  ])('rubrosInexistentes(%j, %j) → %j', (pedidos, existentes, esperado) => {
    expect(rubrosInexistentes(pedidos, existentes)).toEqual(esperado);
  });
});
