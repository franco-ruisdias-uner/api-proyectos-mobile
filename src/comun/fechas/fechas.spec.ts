import {
  aIsoConZona,
  diaDeSemana,
  diaEnZona,
  esDiaValido,
  esHoraValida,
  instanteEnZona,
  leerInstante,
  sumarDias,
} from './fechas.js';

describe('AGENTS §4.3 — Instantes con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00.000Z', '2026-11-14T21:00:00-03:00'],
    ['2026-09-19T13:00:00.999Z', '2026-09-19T10:00:00-03:00'],
    ['2027-01-01T02:59:59Z', '2026-12-31T23:59:59-03:00'],
    ['2027-01-01T03:00:00Z', '2027-01-01T00:00:00-03:00'],
  ])('%s → %s', (utc, esperado) => {
    expect(aIsoConZona(new Date(utc))).toBe(esperado);
  });
});

describe('AGENTS §4.3 — En la entrada se acepta cualquier ISO con offset o Z', () => {
  it.each([
    ['2026-11-14T21:00:00-03:00', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00Z', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00.123Z', '2026-11-15T00:00:00.123Z'],
    ['2026-11-14T21:00-03:00', '2026-11-15T00:00:00.000Z'],
  ])('%s', (texto, utc) => {
    expect(leerInstante(texto)?.toISOString()).toBe(utc);
  });

  it.each([
    '2026-11-14T21:00:00',
    '2026-11-14',
    'mañana',
    '',
    '2026-13-40T25:00:00Z',
  ])('rechaza «%s»', (texto) => {
    expect(leerInstante(texto)).toBeNull();
  });
});

describe('AGENTS §6 — "Hoy" se calcula en hora argentina, no en la del proceso', () => {
  it.each([
    ['2026-09-20T02:59:00Z', '2026-09-19'], // 23:59 del 19 en Villaguay
    ['2026-09-20T03:00:00Z', '2026-09-20'], // 00:00 del 20
    ['2026-10-01T02:30:00Z', '2026-09-30'], // último día del mes
    ['2027-01-01T02:59:59Z', '2026-12-31'], // 31/12
  ])('%s → %s', (utc, dia) => {
    expect(diaEnZona(new Date(utc))).toBe(dia);
  });
});

describe('Días y horas de tabla', () => {
  it.each([
    ['2026-09-19', 6],
    ['2026-09-20', 0],
    ['2026-09-22', 2],
  ])('día de la semana de %s es %i (0 = domingo)', (dia, esperado) => {
    expect(diaDeSemana(dia)).toBe(esperado);
  });

  it.each([
    ['2026-02-28', true],
    ['2026-02-29', false],
    ['2028-02-29', true],
    ['2026-9-1', false],
    ['2026-13-01', false],
  ])('esDiaValido(%s) = %s', (dia, esperado) => {
    expect(esDiaValido(dia)).toBe(esperado);
  });

  it.each([
    ['08:00', true],
    ['23:59', true],
    ['24:00', true],
    ['24:30', false],
    ['8:00', false],
    ['25:00', false],
  ])('esHoraValida(%s) = %s', (hora, esperado) => {
    expect(esHoraValida(hora)).toBe(esperado);
  });

  it.each([
    ['2026-09-30', 1, '2026-10-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
  ])('sumarDias(%s, %i) = %s', (dia, n, esperado) => {
    expect(sumarDias(dia, n)).toBe(esperado);
  });

  it('instanteEnZona arma el instante de una hora de Villaguay', () => {
    expect(instanteEnZona('2026-09-19', '21:00').toISOString()).toBe(
      '2026-09-20T00:00:00.000Z',
    );
  });

  it('"24:00" es la medianoche del día siguiente (D8)', () => {
    expect(aIsoConZona(instanteEnZona('2026-12-31', '24:00'))).toBe(
      '2027-01-01T00:00:00-03:00',
    );
  });
});
