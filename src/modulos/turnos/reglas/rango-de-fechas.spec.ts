import { fechaEnRango } from './rango-de-fechas.js';

describe('PRD §2 / R6 — La grilla se pide desde hoy hasta hoy + 6', () => {
  it.each([
    ['hoy', '2026-09-19', true],
    ['hoy + 6', '2026-09-25', true],
    ['hoy + 7', '2026-09-26', false],
    ['ayer', '2026-09-18', false],
    ['mañana', '2026-09-20', true],
  ])('%s (%s) → %s', (_n, fecha, esperado) => {
    expect(fechaEnRango(fecha, '2026-09-19')).toBe(esperado);
  });

  it('cruza el fin de mes y de año', () => {
    expect(fechaEnRango('2027-01-02', '2026-12-27')).toBe(true);
    expect(fechaEnRango('2027-01-03', '2026-12-27')).toBe(false);
    expect(fechaEnRango('2026-10-01', '2026-09-25')).toBe(true);
  });
});
