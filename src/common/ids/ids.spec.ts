import { esIdConPrefijo, esIdDeCliente, nuevoId } from './ids.js';

describe('AGENTS §4.3 — Ids de texto con prefijo', () => {
  it('nuevoId arma prefijo + 12 caracteres [a-z0-9]', () => {
    const id = nuevoId('usr');
    expect(id).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it('no repite', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nuevoId('lug')));
    expect(ids.size).toBe(1000);
  });

  it.each([
    ['usr-201', 'usr', true],
    ['usr-abc123def456', 'usr', true],
    ['lug-004', 'usr', false],
    ['201', 'usr', false],
    ['usr-', 'usr', false],
    ['usr-a b', 'usr', false],
  ])('esIdConPrefijo(%s, %s) = %s', (id, prefijo, esperado) => {
    expect(esIdConPrefijo(id, prefijo)).toBe(esperado);
  });

  it.each([
    ['vis-311', true],
    ['vis-A_b-9', true],
    ['vis-ab', false],
    ['vis-' + 'a'.repeat(36), true],
    ['vis-' + 'a'.repeat(37), false],
    ['vis-ñandú', false],
  ])('AGENTS §10.5 — id del cliente %s = %s', (id, esperado) => {
    expect(esIdDeCliente(id, 'vis')).toBe(esperado);
  });
});
