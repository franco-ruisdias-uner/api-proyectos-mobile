import { bloqueoCubre, turnoTerminado } from './blocks.js';

describe('R4 — Un bloqueo cubre el día entero o [inicio, fin)', () => {
  it.each([
    [null, null, '08:00', true],
    [null, null, '23:00', true],
    ['10:00', '12:00', '09:00', false],
    ['10:00', '12:00', '10:00', true],
    ['10:00', '12:00', '11:00', true],
    ['10:00', '12:00', '12:00', false],
    ['23:00', '24:00', '23:00', true],
  ])(
    'bloqueo %s–%s sobre el turno de %s → %s',
    (inicio, fin, turno, esperado) => {
      expect(bloqueoCubre({ inicio, fin }, turno)).toBe(esperado);
    },
  );
});

describe('R18 — Sólo se cancelan los turnos que no terminaron', () => {
  const ahora = new Date('2026-09-19T15:30:00-03:00');
  it.each([
    ['2026-09-19', '14:00', true],
    ['2026-09-19', '15:00', false],
    ['2026-09-19', '16:00', false],
    ['2026-09-20', '08:00', false],
    ['2026-09-18', '23:00', true],
  ])('turno del %s %s terminado → %s', (fecha, inicio, esperado) => {
    expect(turnoTerminado(fecha, inicio, ahora)).toBe(esperado);
  });
});
