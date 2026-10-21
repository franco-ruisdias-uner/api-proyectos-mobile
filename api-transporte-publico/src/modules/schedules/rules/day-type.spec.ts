import { tipoDeDia } from './day-type.js';

const feriados = new Set(['2026-05-25', '2026-06-20', '2026-12-25', '2027-01-01']);

describe('Espec. R6 — tipo de día: feriado > domingo > sábado > hábil', () => {
  it.each([
    ['2026-09-18', 'habil', 'viernes'],
    ['2026-09-21', 'habil', 'lunes'],
    ['2026-09-19', 'sabado', 'sábado'],
    ['2026-09-20', 'domingo', 'domingo'],
    ['2026-05-25', 'feriado', 'feriado un lunes'],
    ['2026-06-20', 'feriado', 'feriado que cae sábado: gana el feriado'],
    ['2026-12-25', 'feriado', 'feriado un viernes'],
    ['2027-01-01', 'feriado', 'primer día del año'],
    ['2026-12-31', 'habil', 'último día del año, jueves'],
    ['2028-02-29', 'habil', 'día bisiesto, martes'],
  ])('%s → %s (%s)', (dia, esperado) => {
    expect(tipoDeDia(dia, feriados)).toBe(esperado);
  });

  it('un feriado que cae domingo también es feriado', () => {
    expect(tipoDeDia('2026-09-20', new Set(['2026-09-20']))).toBe('feriado');
  });

  it('sin tabla de feriados, se decide sólo por el día de la semana', () => {
    expect(tipoDeDia('2026-05-25', new Set())).toBe('habil');
  });
});
