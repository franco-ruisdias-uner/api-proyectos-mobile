import { aIsoConZona, parsearInstante, diaEnZona } from './fechas.js';

describe('AGENTS §4.3 — Instantes en ISO 8601 con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00Z', '2026-11-14T21:00:00-03:00'],
    ['2026-09-14T13:22:00.999Z', '2026-09-14T10:22:00-03:00'],
    ['2026-01-01T02:59:59Z', '2025-12-31T23:59:59-03:00'],
    ['2026-03-01T03:00:00Z', '2026-03-01T00:00:00-03:00'],
  ])('%s → %s', (utc, esperado) => {
    expect(aIsoConZona(new Date(utc))).toBe(esperado);
  });
});

describe('AGENTS §4.3 — En la entrada se acepta cualquier ISO con offset o Z', () => {
  it.each([
    ['2026-09-14T10:22:00-03:00', '2026-09-14T13:22:00.000Z'],
    ['2026-09-14T13:22:00Z', '2026-09-14T13:22:00.000Z'],
    ['2026-09-14T13:22:00.500Z', '2026-09-14T13:22:00.000Z'],
    ['2026-09-14T10:22-03:00', '2026-09-14T13:22:00.000Z'],
    ['2026-09-14T15:22:00+02:00', '2026-09-14T13:22:00.000Z'],
    ['2026-09-14T10:22:00-0300', '2026-09-14T13:22:00.000Z'],
    ['2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z'],
  ])('%s se normaliza', (texto, utc) => {
    expect(parsearInstante(texto)?.toISOString()).toBe(utc);
  });

  it.each([
    ['sin offset', '2026-09-14T10:22:00'],
    ['sólo día', '2026-09-14'],
    ['mes 13', '2026-13-01T00:00:00Z'],
    ['30 de febrero', '2026-02-30T00:00:00Z'],
    ['29/2 en año no bisiesto', '2026-02-29T00:00:00Z'],
    ['hora 24', '2026-09-14T24:00:00Z'],
    ['offset imposible', '2026-09-14T10:00:00+25:00'],
    ['texto', 'ayer'],
    ['número', 1726320000000],
    ['vacío', ''],
  ])('rechaza %s', (_caso, texto) => {
    expect(parsearInstante(texto)).toBeNull();
  });
});

describe('AGENTS §6 — El día se calcula en America/Argentina/Buenos_Aires', () => {
  it.each([
    ['23:59 → sigue siendo el mismo día', '2026-09-15T02:59:59Z', '2026-09-14'],
    ['00:00 → día siguiente', '2026-09-15T03:00:00Z', '2026-09-15'],
    ['31/12 a la noche', '2027-01-01T02:59:59Z', '2026-12-31'],
    ['último día del mes', '2026-10-01T02:00:00Z', '2026-09-30'],
  ])('%s', (_caso, utc, dia) => {
    expect(diaEnZona(new Date(utc))).toBe(dia);
  });
});
