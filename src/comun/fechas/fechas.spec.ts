import {
  aIsoConZona,
  diaDeLaSemana,
  diaEnZona,
  horaEnZona,
  interpretarInstante,
  sumarDias,
} from './fechas.js';

describe('AGENTS §4.3 — instantes con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00.000Z', '2026-11-14T21:00:00-03:00'],
    ['2026-11-15T00:00:00.999Z', '2026-11-14T21:00:00-03:00'],
    ['2026-01-01T02:59:59Z', '2025-12-31T23:59:59-03:00'],
    ['2026-01-01T03:00:00Z', '2026-01-01T00:00:00-03:00'],
    ['2026-03-01T02:59:00Z', '2026-02-28T23:59:00-03:00'],
  ])('%s → %s', (utc, esperado) => {
    expect(aIsoConZona(new Date(utc))).toBe(esperado);
  });
});

describe('AGENTS §4.3 — en la entrada se acepta cualquier ISO con offset o Z', () => {
  it.each([
    ['2026-11-14T21:00:00-03:00', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00Z', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00.123Z', '2026-11-15T00:00:00.123Z'],
    ['2026-11-15T02:00:00+02:00', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00Z', '2026-11-15T00:00:00.000Z'],
  ])('%s', (texto, utc) => {
    expect(interpretarInstante(texto)?.toISOString()).toBe(utc);
  });

  it.each([
    ['2026-11-14T21:00:00'],
    ['2026-11-14'],
    ['14/11/2026 21:00'],
    ['2026-13-01T00:00:00Z'],
    ['2026-02-30T00:00:00Z'],
    ['1731628800000'],
    [''],
  ])('rechaza %j', (texto) => {
    expect(interpretarInstante(texto)).toBeNull();
  });
});

describe('AGENTS §6 — "hoy" y el día de la semana se calculan en Buenos Aires', () => {
  it.each([
    // 23:59 en Buenos Aires ya es el día siguiente en UTC
    ['2026-11-15T02:59:00Z', '2026-11-14', 6, '23:59'],
    ['2026-11-15T03:00:00Z', '2026-11-15', 0, '00:00'],
    // último día del mes y 31/12
    ['2026-10-01T02:30:00Z', '2026-09-30', 3, '23:30'],
    ['2027-01-01T02:59:00Z', '2026-12-31', 4, '23:59'],
    ['2027-01-01T03:00:00Z', '2027-01-01', 5, '00:00'],
  ])('%s → %s (día %i, %s)', (utc, dia, semana, hora) => {
    const instante = new Date(utc);
    expect(diaEnZona(instante)).toBe(dia);
    expect(diaDeLaSemana(instante)).toBe(semana);
    expect(horaEnZona(instante)).toBe(hora);
  });

  it.each([
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-01-01', -1, '2025-12-31'],
  ])('sumarDias(%s, %i) = %s', (dia, n, esperado) => {
    expect(sumarDias(dia, n)).toBe(esperado);
  });
});
