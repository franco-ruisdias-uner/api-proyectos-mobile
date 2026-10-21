import {
  correlativoSiguiente,
  formatearCodigo,
  normalizarCodigo,
  prefijoDelAnio,
} from './code.js';

describe('R4 — El código de seguimiento es GCHU-<año>-<5 dígitos>', () => {
  it.each([
    [2026, 1, 'GCHU-2026-00001'],
    [2026, 412, 'GCHU-2026-00412'],
    [2027, 99999, 'GCHU-2027-99999'],
  ])('formatearCodigo(%i, %i) = %s', (anio, n, esperado) => {
    expect(formatearCodigo(anio, n)).toBe(esperado);
  });

  it('el prefijo del año sirve para buscar el último correlativo', () => {
    expect(prefijoDelAnio(2026)).toBe('GCHU-2026-');
  });

  it.each([
    [null, 1],
    ['GCHU-2026-00412', 413],
    ['GCHU-2026-00009', 10],
  ])('correlativoSiguiente(%s) = %i', (ultimo, esperado) => {
    expect(correlativoSiguiente(ultimo)).toBe(esperado);
  });

  it.each([
    ['GCHU-2026-00412', 'GCHU-2026-00412'],
    ['  gchu-2026-00412 ', 'GCHU-2026-00412'],
    ['GCHU-2026-412', null],
    ['GCHU-26-00412', null],
    ['REP-2026-00412', null],
    ['', null],
  ])('normalizarCodigo(%j) = %j', (entrada, esperado) => {
    expect(normalizarCodigo(entrada)).toBe(esperado);
  });
});
