import {
  esIdDeResena,
  estrellasParaPromedio,
  fechaEnElFuturo,
  promedioDeEstrellas,
} from './resenas.js';

describe('PRD §4 / R8 — Puntaje: promedio de estrellas con un decimal, 0 sin reseñas (D7)', () => {
  it.each([
    [[], 0],
    [[5], 5],
    [[4, 5], 4.5],
    [[5, 5, 4], 4.7],
    [[1, 2], 1.5],
    [[5, 4, 4], 4.3],
    [[1, 1, 2], 1.3],
    [[3, 3, 3, 3], 3],
  ])('%j → %d', (estrellas, esperado) => {
    expect(promedioDeEstrellas(estrellas)).toBe(esperado);
  });
});

describe('R15 — La fecha de una reseña no puede ser futura (tolerancia de 5 minutos)', () => {
  const ahora = new Date('2026-10-03T15:00:00Z');
  it.each([
    ['2026-10-03T14:00:00Z', false],
    ['2026-10-03T15:00:00Z', false],
    ['2026-10-03T15:05:00Z', false],
    ['2026-10-03T15:05:01Z', true],
    ['2026-10-04T15:00:00Z', true],
  ])('%s → futura: %s', (instante, esperado) => {
    expect(fechaEnElFuturo(new Date(instante), ahora)).toBe(esperado);
  });
});

describe('AGENTS §10.5 — Ids de reseña', () => {
  it.each([
    ['res-2210', true],
    ['res-abc_DEF-123', true],
    ['res-ab', false],
    ['lug-2210', false],
    ['res-', false],
    ['res-con espacio', false],
    ['res-' + 'a'.repeat(37), false],
  ])('%s → %s', (id, esperado) => {
    expect(esIdDeResena(id)).toBe(esperado);
  });
});

describe('Semillas — estrellas que dan el promedio pedido', () => {
  it.each([
    [12, 4.6],
    [87, 4.8],
    [2, 4],
    [31, 4.4],
    [1, 3.9],
    [5, 3.9],
    [60, 3.8],
  ])('%d reseñas con promedio %d', (cantidad, objetivo) => {
    const estrellas = estrellasParaPromedio(cantidad, objetivo);
    expect(estrellas).toHaveLength(cantidad);
    expect(estrellas.every((e) => Number.isInteger(e) && e >= 1 && e <= 5)).toBe(true);
    expect(Math.abs(promedioDeEstrellas(estrellas) - objetivo)).toBeLessThanOrEqual(
      cantidad === 1 ? 0.5 : 0.1 + 1e-9,
    );
  });
  it('sin reseñas, una lista vacía', () => {
    expect(estrellasParaPromedio(0, 0)).toEqual([]);
  });
});
