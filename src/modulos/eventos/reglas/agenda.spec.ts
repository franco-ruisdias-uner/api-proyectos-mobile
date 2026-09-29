import {
  comienzoDelDia,
  comienzoDelDiaSiguiente,
  esDiaValido,
  estadoVisible,
  finEfectivo,
  seSuperpone,
} from './agenda.js';

const d = (s: string) => new Date(s);

describe('PRD §3 — Reglas de la agenda', () => {
  it.each([
    ['2026-11-14', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['2026-1-1', false],
    ['14/11/2026', false],
    ['', false],
  ])('esDiaValido(%s) = %s', (dia, esperado) => {
    expect(esDiaValido(dia)).toBe(esperado);
  });

  it('los días empiezan a las 00:00 de Buenos Aires, no de UTC', () => {
    expect(comienzoDelDia('2026-11-14').toISOString()).toBe('2026-11-14T03:00:00.000Z');
    expect(comienzoDelDiaSiguiente('2026-12-31').toISOString()).toBe('2027-01-01T03:00:00.000Z');
    expect(comienzoDelDiaSiguiente('2026-02-28').toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  describe('R8 — fin efectivo', () => {
    it('con fin, es el fin', () => {
      expect(finEfectivo(d('2026-11-14T21:00:00-03:00'), d('2026-11-15T02:00:00-03:00')).toISOString()).toBe(
        '2026-11-15T05:00:00.000Z',
      );
    });
    it.each([
      ['2026-11-14T21:00:00-03:00', '2026-11-15T02:59:59.000Z'],
      ['2026-11-14T00:00:00-03:00', '2026-11-15T02:59:59.000Z'],
      ['2026-11-14T23:59:00-03:00', '2026-11-15T02:59:59.000Z'],
      // 23:30 de Buenos Aires ya es el día siguiente en UTC: cuenta el día local.
      ['2026-12-31T23:30:00-03:00', '2027-01-01T02:59:59.000Z'],
    ])('sin fin, hasta las 23:59 del día de %s', (inicio, esperado) => {
      expect(finEfectivo(d(inicio), null).toISOString()).toBe(esperado);
    });
  });

  describe('R9 — finalizado se calcula', () => {
    const fin = d('2026-11-14T23:00:00-03:00');
    it.each([
      ['programado', '2026-11-14T22:59:59-03:00', 'programado'],
      ['programado', '2026-11-14T23:00:00-03:00', 'programado'],
      ['programado', '2026-11-14T23:00:01-03:00', 'finalizado'],
      ['suspendido', '2026-11-20T10:00:00-03:00', 'suspendido'],
      ['cancelado', '2026-11-20T10:00:00-03:00', 'cancelado'],
    ] as const)('%s con ahora=%s → %s', (guardado, ahora, esperado) => {
      expect(estadoVisible(guardado, fin, d(ahora))).toBe(esperado);
    });
  });

  describe('R8 — superposición con un día', () => {
    const desde = comienzoDelDia('2026-11-14');
    const hasta = comienzoDelDiaSiguiente('2026-11-14');
    it.each([
      ['dentro del día', '2026-11-14T21:00:00-03:00', '2026-11-14T23:00:00-03:00', true],
      ['cruza la medianoche, primer día', '2026-11-14T21:00:00-03:00', '2026-11-15T02:00:00-03:00', true],
      ['cruza la medianoche, segundo día', '2026-11-13T21:00:00-03:00', '2026-11-14T02:00:00-03:00', true],
      ['terminó justo a las 00:00', '2026-11-13T21:00:00-03:00', '2026-11-14T00:00:00-03:00', false],
      [
        'empieza justo a las 00:00 del día siguiente',
        '2026-11-15T00:00:00-03:00',
        '2026-11-15T01:00:00-03:00',
        false,
      ],
      ['empieza a las 00:00 del día', '2026-11-14T00:00:00-03:00', '2026-11-14T00:00:00-03:00', true],
      ['abarca el día entero', '2026-11-13T10:00:00-03:00', '2026-11-15T10:00:00-03:00', true],
      ['el día anterior', '2026-11-13T10:00:00-03:00', '2026-11-13T12:00:00-03:00', false],
    ])('%s', (_caso, inicio, fin, esperado) => {
      expect(seSuperpone(d(inicio), d(fin), desde, hasta)).toBe(esperado);
    });
    it('sin tope, alcanza con que termine después del comienzo', () => {
      expect(seSuperpone(d('2026-11-13T10:00:00-03:00'), d('2026-11-14T10:00:00-03:00'), desde, null)).toBe(
        true,
      );
    });
  });
});
