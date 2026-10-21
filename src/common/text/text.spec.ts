import { normalizarBusqueda } from './text.js';

describe('AGENTS §5.5 — Búsqueda sin mayúsculas ni tildes', () => {
  it.each([
    ['Colón', 'colon'],
    ['  PALMAR   el  ', 'palmar el'],
    ['Ñandú', 'nandu'],
    ['Güemes', 'guemes'],
    ['', ''],
  ])('%s → %s', (entrada, salida) => {
    expect(normalizarBusqueda(entrada)).toBe(salida);
  });
});
