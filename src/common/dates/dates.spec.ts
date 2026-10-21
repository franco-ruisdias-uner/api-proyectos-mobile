import { aIsoConZona, diaDeLaSemana, diaLocal, esInstanteConZona, leerInstante } from './dates.js';

describe('AGENTS §4.3 — Instantes con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00.000Z', '2026-11-14T21:00:00-03:00'],
    ['2026-11-15T02:59:59.999Z', '2026-11-14T23:59:59-03:00'],
    ['2026-11-15T03:00:00.000Z', '2026-11-15T00:00:00-03:00'],
    ['2027-01-01T02:59:00.000Z', '2026-12-31T23:59:00-03:00'],
    ['2026-10-01T02:30:00.000Z', '2026-09-30T23:30:00-03:00'],
  ])('%s → %s', (utc, esperado) => {
    expect(aIsoConZona(new Date(utc))).toBe(esperado);
  });
});

describe('AGENTS §6 — "Hoy" y el día de la semana se calculan en Buenos Aires', () => {
  it.each([
    // 23:59 del 31/12 en Argentina es 02:59 UTC del 1/1
    ['2027-01-01T02:59:00Z', '2026-12-31', 4],
    ['2027-01-01T03:00:00Z', '2027-01-01', 5],
    ['2026-10-01T02:00:00Z', '2026-09-30', 3],
    ['2026-09-27T12:00:00Z', '2026-09-27', 0],
  ])('%s → día %s, semana %i', (utc, dia, semana) => {
    expect(diaLocal(new Date(utc))).toBe(dia);
    expect(diaDeLaSemana(new Date(utc))).toBe(semana);
  });
});

describe('AGENTS §4.3 — En la entrada se acepta cualquier ISO con offset o Z', () => {
  it.each([
    ['2026-11-14T21:00:00-03:00', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00Z', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00.123Z', '2026-11-15T00:00:00.123Z'],
    ['2026-11-14T22:00:00-02:00', '2026-11-15T00:00:00.000Z'],
  ])('%s', (entrada, utc) => {
    expect(esInstanteConZona(entrada)).toBe(true);
    expect(leerInstante(entrada)?.toISOString()).toBe(utc);
  });

  it.each([
    '2026-11-14T21:00:00',
    '2026-11-14',
    'mañana',
    '',
    '2026-13-01T00:00:00Z',
    '2026-02-30T00:00:00Z',
  ])('rechaza %s', (entrada) => {
    expect(esInstanteConZona(entrada)).toBe(false);
    expect(leerInstante(entrada)).toBeNull();
  });
});
