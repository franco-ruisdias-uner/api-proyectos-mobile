import { esIdDe, nuevoId } from './ids.js';

describe('AGENTS §4.3 — Ids de texto con el prefijo del PRD', () => {
  it('nuevoId arma prefijo + 12 caracteres [a-z0-9]', () => {
    const ids = new Set(Array.from({ length: 200 }, () => nuevoId('usr')));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it.each([
    ['usr', 'usr-011', true],
    ['usr', 'usr-4k2j9x0a1b2c', true],
    ['usr', 'lec-011', false],
    ['usr', 'usr-', false],
    ['usr', 'usr-a b', false],
    ['usr', 11, false],
    ['usr', 'usr-' + 'a'.repeat(37), false],
  ])('esIdDe(%s, %o) = %s', (prefijo, valor, esperado) => {
    expect(esIdDe(prefijo, valor)).toBe(esperado);
  });
});
