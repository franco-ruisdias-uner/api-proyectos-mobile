import {
  fijaCubre,
  fijasSeSuperponen,
  validarFechasDeFija,
  type DatosDeFija,
} from './fijas.js';

const base: DatosDeFija = {
  dia: 2,
  inicio: '21:00',
  fin: '22:00',
  desde: '2026-09-01',
  hasta: null,
};

describe('R3 — Qué turnos cubre una fija', () => {
  // 2026-09-22 es martes.
  it.each([
    ['2026-09-22', '21:00', true],
    ['2026-09-22', '22:00', false],
    ['2026-09-22', '20:00', false],
    ['2026-09-23', '21:00', false],
    ['2026-09-15', '21:00', true],
    ['2026-08-25', '21:00', false],
  ])(
    'fija de los martes de 21 a 22 el %s %s → %s',
    (fecha, inicio, esperado) => {
      expect(fijaCubre(base, fecha, inicio)).toBe(esperado);
    },
  );

  it('una fija de dos horas cubre dos turnos', () => {
    const f = { ...base, inicio: '20:00', fin: '22:00' };
    expect(fijaCubre(f, '2026-09-22', '20:00')).toBe(true);
    expect(fijaCubre(f, '2026-09-22', '21:00')).toBe(true);
    expect(fijaCubre(f, '2026-09-22', '22:00')).toBe(false);
  });

  it('respeta `hasta` inclusive', () => {
    const f = { ...base, hasta: '2026-09-22' };
    expect(fijaCubre(f, '2026-09-22', '21:00')).toBe(true);
    expect(fijaCubre(f, '2026-09-29', '21:00')).toBe(false);
  });
});

describe('R19 — Fechas de la fija: desde ≤ hasta', () => {
  it.each([
    ['2026-09-01', null, null],
    ['2026-09-01', '2026-09-01', null],
    ['2026-09-01', '2026-12-31', null],
  ])('%s a %s es válido', (desde, hasta, esperado) => {
    expect(validarFechasDeFija(desde, hasta)).toBe(esperado);
  });
  it.each([
    ['2026-09-02', '2026-09-01'],
    ['2026-02-30', null],
    ['2026-09-01', '2026-13-01'],
  ])('%s a %s se rechaza', (desde, hasta) => {
    expect(validarFechasDeFija(desde, hasta)).toEqual(expect.any(String));
  });
});

describe('R19 — Dos fijas se superponen si comparten día, horas y fechas', () => {
  it.each([
    ['mismo horario', {}, true],
    ['otro día', { dia: 3 }, false],
    ['horas contiguas', { inicio: '22:00', fin: '23:00' }, false],
    ['horas que se pisan', { inicio: '20:00', fin: '22:00' }, true],
    ['una dentro de la otra', { inicio: '08:00', fin: '24:00' }, true],
    [
      'vigencias disjuntas',
      { desde: '2025-01-01', hasta: '2026-08-31' },
      false,
    ],
    [
      'vigencia que toca el borde',
      { desde: '2025-01-01', hasta: '2026-09-01' },
      true,
    ],
    ['la otra no termina nunca', { desde: '2030-01-01', hasta: null }, true],
  ])('%s → %s', (_nombre, cambio, esperado) => {
    expect(fijasSeSuperponen(base, { ...base, ...cambio })).toBe(esperado);
    expect(fijasSeSuperponen({ ...base, ...cambio }, base)).toBe(esperado);
  });
});
