import { compararPorLegajo, normalizarLegajo } from './legajo.js';

describe('ESPECIFICACION R1 — El legajo se compara sin distinguir mayúsculas', () => {
  it.each([
    ['L-011', 'l-011'],
    [' l-011 ', 'l-011'],
    ['ÁB-1', 'áb-1'],
  ])('%o → %o', (legajo, normalizado) => {
    expect(normalizarLegajo(legajo)).toBe(normalizado);
  });

  it('ordena por legajo y desempata por id', () => {
    const lista = [
      { legajoBusqueda: 'l-020', id: 'usr-b' },
      { legajoBusqueda: 'l-011', id: 'usr-z' },
      { legajoBusqueda: 'l-011', id: 'usr-a' },
    ].sort(compararPorLegajo);
    expect(lista.map((u) => u.id)).toEqual(['usr-a', 'usr-z', 'usr-b']);
  });
});
