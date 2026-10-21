import { normalizarParaBusqueda } from './text.js';

describe('AGENTS §5.5 — Búsqueda sin mayúsculas ni tildes', () => {
  it.each([
    ['Colón', 'colon'],
    ['  Ramón   DUARTE ', 'ramon duarte'],
    ['Núñez', 'nunez'],
    ['L-011', 'l-011'],
  ])('%o → %o', (entrada, salida) => {
    expect(normalizarParaBusqueda(entrada)).toBe(salida);
  });
});
