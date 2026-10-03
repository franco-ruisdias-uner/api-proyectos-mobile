import { esIdValido, nuevoId } from './ids.js';

describe('AGENTS §4.3 — Ids de texto con prefijo', () => {
  it('nuevoId arma prefijo + 12 caracteres [a-z0-9]', () => {
    const id = nuevoId('usr');
    expect(id).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it('no repite ids', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => nuevoId('res')));
    expect(ids.size).toBe(2000);
  });

  it.each([
    ['usr-512', 'usr', true],
    ['rub-ferreteria', 'rub', true],
    ['res-abc_DEF-123', 'res', true],
    ['res-ab', 'res', false],
    ['usr-512', 'com', false],
    ['512', 'usr', false],
    ['usr-', 'usr', false],
    ['usr-' + 'a'.repeat(37), 'usr', false],
    ['usr-12 3', 'usr', false],
  ])('esIdValido(%s, %s) = %s', (id, prefijo, esperado) => {
    expect(esIdValido(id, prefijo)).toBe(esperado);
  });
});
