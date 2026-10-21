import { esIdDe, esIdDeCliente, nuevoId } from './ids.js';

describe('AGENTS §4.3 — ids de texto con prefijo', () => {
  it('nuevoId arma prefijo + 12 caracteres [a-z0-9]', () => {
    for (let i = 0; i < 50; i++) expect(nuevoId('usr')).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it('no repite', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nuevoId('avi')));
    expect(ids.size).toBe(1000);
  });

  it.each([
    ['lin', 'lin-05', true],
    ['par', 'par-101', true],
    ['usr', 'usr-abc123def456', true],
    ['lin', 'par-101', false],
    ['lin', 'lin-', false],
    ['lin', 'lin', false],
    ['lin', '5', false],
    ['lin', 'lin-05 ', false],
    ['lin', 'lin-05/../x', false],
    ['lin', 'lin-' + 'a'.repeat(37), false],
  ])('esIdDe(%s, %j) = %s', (prefijo, valor, esperado) => {
    expect(esIdDe(prefijo, valor)).toBe(esperado);
  });

  it.each([
    ['rep-abc', true],
    ['rep-A_b-9', true],
    ['rep-' + 'x'.repeat(36), true],
    ['rep-ab', false],
    ['rep-' + 'x'.repeat(37), false],
    ['rep-a b', false],
    ['usr-abc', false],
  ])('AGENTS §10.5 — id generado por el cliente %j → %s', (valor, esperado) => {
    expect(esIdDeCliente('rep', valor)).toBe(esperado);
  });
});
