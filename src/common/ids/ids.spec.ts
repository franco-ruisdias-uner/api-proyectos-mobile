import { nuevoId, esIdDe, esIdDeCliente } from './ids.js';

describe('AGENTS §4.3 — Ids de texto con prefijo', () => {
  it('nuevoId genera prefijo + 12 caracteres [a-z0-9]', () => {
    expect(nuevoId('usr')).toMatch(/^usr-[a-z0-9]{12}$/);
  });

  it('no repite en mil generaciones', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => nuevoId('rep')));
    expect(ids.size).toBe(1000);
  });

  it.each([
    ['usr-084', true],
    ['usr-abc123def456', true],
    ['usr-ABC_x-1', true],
    ['rep-00412', false],
    ['usr-', false],
    ['usr', false],
    ['usr-' + 'a'.repeat(37), false],
    [84, false],
    [null, false],
  ])('esIdDe("usr", %s) = %s', (valor, esperado) => {
    expect(esIdDe('usr', valor)).toBe(esperado);
  });
});

describe('AGENTS §10.5 — Id generado por el cliente', () => {
  it.each([
    ['rep-k3x9', true],
    ['rep-ABC_def-123', true],
    ['rep-' + 'a'.repeat(36), true],
    ['rep-' + 'a'.repeat(37), false],
    ['rep-ab', false],
    ['fot-k3x9', false],
    ['rep-k3x9!', false],
    ['rep-k3 x9', false],
  ])('esIdDeCliente("rep", %s) = %s', (valor, esperado) => {
    expect(esIdDeCliente('rep', valor)).toBe(esperado);
  });
});
