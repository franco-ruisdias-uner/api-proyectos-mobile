import { normalizarParaBusqueda } from './text.js';

describe('AGENTS §5.5 — Búsqueda sin tildes ni mayúsculas', () => {
  it.each([
    ['Colón', 'colon'],
    ['  Ferretería   EL  Tornillo ', 'ferreteria el tornillo'],
    ['PANADERÍA La Unión', 'panaderia la union'],
    ['Ñandú', 'nandu'],
    ['pingüino', 'pinguino'],
    ['línea\tnueva\n', 'linea nueva'],
    ['', ''],
  ])('%j → %j', (entrada, esperado) => {
    expect(normalizarParaBusqueda(entrada)).toBe(esperado);
  });
});
