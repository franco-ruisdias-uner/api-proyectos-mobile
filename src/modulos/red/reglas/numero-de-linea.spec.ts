import { compararLineas, ordenDeNumero } from './numero-de-linea.js';

describe('Espec. §4 M1 — las líneas se ordenan por número, no por texto', () => {
  it.each([
    ['2', 2],
    ['14', 14],
    ['05', 5],
    ['8A', 8],
    ['A', Number.MAX_SAFE_INTEGER],
    ['', Number.MAX_SAFE_INTEGER],
  ])('ordenDeNumero(%j) = %j', (numero, esperado) => {
    expect(ordenDeNumero(numero)).toBe(esperado);
  });

  it('"2" va antes que "14" y que "10"', () => {
    const lineas = ['14', '2', '10', '1'].map((numero, i) => ({
      id: `lin-${i}`,
      numero,
      numeroOrden: ordenDeNumero(numero),
    }));
    expect(lineas.sort(compararLineas).map((l) => l.numero)).toEqual(['1', '2', '10', '14']);
  });

  it('si el número empata, desempata por el texto y después por id', () => {
    const lineas = [
      { id: 'lin-b', numero: '8B', numeroOrden: 8 },
      { id: 'lin-z', numero: '8', numeroOrden: 8 },
      { id: 'lin-a', numero: '8', numeroOrden: 8 },
    ];
    expect(lineas.sort(compararLineas).map((l) => l.id)).toEqual(['lin-a', 'lin-z', 'lin-b']);
  });
});
