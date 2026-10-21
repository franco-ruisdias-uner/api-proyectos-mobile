import { aIsoConZona, diaDeSemanaEnZona, hoyEnZona, parsearInstante } from './dates.js';

describe('AGENTS §4.3 — Instantes con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00Z', '2026-11-14T21:00:00-03:00'],
    ['2026-11-15T00:00:00.999Z', '2026-11-14T21:00:00-03:00'],
    ['2026-01-01T02:59:59Z', '2025-12-31T23:59:59-03:00'],
    ['2026-01-01T03:00:00Z', '2026-01-01T00:00:00-03:00'],
    ['2026-02-28T03:00:00Z', '2026-02-28T00:00:00-03:00'],
  ])('%s → %s', (entrada, esperado) => {
    expect(aIsoConZona(new Date(entrada))).toBe(esperado);
  });
});

describe('AGENTS §6 — "Hoy" y el día de la semana se calculan en Buenos Aires', () => {
  it.each([
    // 23:59 del 31/12 en Buenos Aires: todavía es 31/12, aunque en UTC ya sea 1/1.
    ['2026-01-01T02:59:00Z', '2025-12-31', 3],
    // 00:00 del 1/1 en Buenos Aires.
    ['2026-01-01T03:00:00Z', '2026-01-01', 4],
    // Último día de un mes.
    ['2026-10-01T02:00:00Z', '2026-09-30', 3],
    // Domingo = 0.
    ['2026-10-04T15:00:00Z', '2026-10-04', 0],
  ])('%s → %s (día %i)', (instante, dia, diaSemana) => {
    expect(hoyEnZona(new Date(instante))).toBe(dia);
    expect(diaDeSemanaEnZona(new Date(instante))).toBe(diaSemana);
  });
});

describe('AGENTS §4.3 — En la entrada se acepta cualquier ISO con offset o Z', () => {
  it.each([
    ['2026-11-14T21:00:00-03:00', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00Z', '2026-11-15T00:00:00.000Z'],
    ['2026-11-15T00:00:00.123Z', '2026-11-15T00:00:00.123Z'],
    ['2026-11-15T01:00:00+01:00', '2026-11-15T00:00:00.000Z'],
  ])('%s se acepta', (texto, utc) => {
    expect(parsearInstante(texto)?.toISOString()).toBe(utc);
  });

  it.each([
    ['2026-11-15T00:00:00'], // sin zona: ambiguo
    ['2026-11-15'],
    ['15/11/2026'],
    ['2026-13-01T00:00:00Z'],
    ['2026-02-30T00:00:00Z'],
    [''],
    ['mañana'],
  ])('%s se rechaza', (texto) => {
    expect(parsearInstante(texto)).toBeNull();
  });
});
