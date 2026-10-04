import { esIdDe, nuevoId } from './ids.js';

describe('AGENTS §4.3 — Ids de texto con prefijo', () => {
  it('nuevoId arma prefijo + 12 caracteres [a-z0-9]', () => {
    expect(nuevoId('usr')).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it('no repite ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nuevoId('res')));
    expect(ids.size).toBe(1000);
  });

  it.each([
    ['usr', 'usr-207', true],
    ['esp', 'esp-02', true],
    ['usr', 'esp-02', false],
    ['usr', 'usr-', false],
    ['usr', 207, false],
    ['usr', 'usr-a b', false],
  ])('esIdDe(%s, %s) = %s', (prefijo, valor, esperado) => {
    expect(esIdDe(prefijo, valor)).toBe(esperado);
  });
});
