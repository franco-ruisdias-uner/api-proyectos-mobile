import { normalizarParaBusqueda } from './texto.js';

describe('AGENTS §5.5 — búsqueda sin tildes ni mayúsculas', () => {
  it.each([
    ['Colón', 'colon'],
    ['  ALAMEDA   y  Urquiza ', 'alameda y urquiza'],
    ['Peñaloza', 'penaloza'],
    ['Güemes', 'guemes'],
    ['Almafuerte\ty\nNewbery', 'almafuerte y newbery'],
    ['a\u0000b', 'a b'],
    ['', ''],
  ])('%j → %j', (entrada, salida) => {
    expect(normalizarParaBusqueda(entrada)).toBe(salida);
  });
});
