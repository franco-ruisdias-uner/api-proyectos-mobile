import { normalizarParaBusqueda } from './texto.js';

describe('AGENTS §5.5 — búsqueda sin tildes ni mayúsculas', () => {
  it.each([
    ['Colón', 'colon'],
    ['  ALAMEDA   y  Urquiza ', 'alameda y urquiza'],
    ['Peñaloza', 'penaloza'],
    ['Güemes', 'guemes'],
    ['Almafuerte\ty\nNewbery', 'almafuerte y newbery'],
    ['', ''],
  ])('%j → %j', (entrada, salida) => {
    expect(normalizarParaBusqueda(entrada)).toBe(salida);
  });
});
