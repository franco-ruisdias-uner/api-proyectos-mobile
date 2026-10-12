import {
  aIsoConZona,
  diaEnArgentina,
  diaYMesEnArgentina,
  leerInstante,
} from './fechas.js';

describe('AGENTS §4.3 — Instantes con offset -03:00 y sin milisegundos', () => {
  it.each([
    ['2026-11-15T00:00:00Z', '2026-11-14T21:00:00-03:00'],
    ['2026-09-15T11:00:00.999Z', '2026-09-15T08:00:00-03:00'],
    // 23:59 → 00:00 en Argentina
    ['2026-09-16T02:59:59Z', '2026-09-15T23:59:59-03:00'],
    ['2026-09-16T03:00:00Z', '2026-09-16T00:00:00-03:00'],
    // último día del mes y 31/12
    ['2026-10-01T02:30:00Z', '2026-09-30T23:30:00-03:00'],
    ['2027-01-01T02:59:00Z', '2026-12-31T23:59:00-03:00'],
  ])('%s → %s', (utc, esperado) => {
    expect(aIsoConZona(new Date(utc))).toBe(esperado);
  });

  it('el día y el DD/MM se calculan en hora argentina, no en la de la máquina', () => {
    const casiMedianoche = new Date('2027-01-01T02:59:00Z');
    expect(diaEnArgentina(casiMedianoche)).toBe('2026-12-31');
    expect(diaYMesEnArgentina(casiMedianoche)).toBe('31/12');
    expect(diaEnArgentina(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
  });
});

describe('AGENTS §4.3 — En la entrada se acepta cualquier ISO con zona', () => {
  it.each([
    ['2026-09-15T08:00:00-03:00', '2026-09-15T11:00:00.000Z'],
    ['2026-09-15T11:00:00Z', '2026-09-15T11:00:00.000Z'],
    ['2026-09-15T11:00:00.123Z', '2026-09-15T11:00:00.123Z'],
    ['2026-09-15T13:00+02:00', '2026-09-15T11:00:00.000Z'],
  ])('%s', (texto, utc) => {
    expect(leerInstante(texto)?.toISOString()).toBe(utc);
  });

  it.each([
    '2026-09-15T08:00:00',
    '2026-09-15',
    'ayer',
    '2026-02-31T08:00:00-03:00',
    '2026-13-01T00:00:00Z',
    '',
  ])('rechaza %o', (texto) => {
    expect(leerInstante(texto)).toBeNull();
  });
});
