import { chocaConOtroReporte, esFechaFutura, esReciente, limiteDeRecientes } from './timings.js';

const MIN = 60_000;
const AHORA = new Date('2026-09-30T15:00:00Z');
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MIN);

describe('R14 — un reporte es reciente durante 90 minutos', () => {
  it.each([
    [0, true],
    [89, true],
    [90, true],
    [91, false],
    [600, false],
    [-3, true], // un reloj del teléfono apenas adelantado
  ])('un reporte de hace %i minutos → %s', (minutos, esperado) => {
    expect(esReciente(hace(minutos), AHORA)).toBe(esperado);
  });

  it('el límite es ahora menos 90 minutos', () => {
    expect(limiteDeRecientes(AHORA)).toEqual(hace(90));
  });
});

describe('R13 — un reporte por línea y parada cada 15 minutos', () => {
  it.each([
    [0, true],
    [14, true],
    [15, false],
    [16, false],
    [-14, true], // el otro es posterior (cola offline fuera de orden)
    [-15, false],
  ])('con otro de hace %i minutos de diferencia → choca: %s', (minutos, choca) => {
    expect(chocaConOtroReporte(hace(0), hace(minutos))).toBe(choca);
  });
});

describe('AGENTS §10.5 — la fecha del hecho no puede estar en el futuro (tolerancia de 5 minutos)', () => {
  it.each([
    [-10, false],
    [0, false],
    [5, false],
    [6, true],
    [60, true],
  ])('fecha %i minutos adelante → futura: %s', (minutos, futura) => {
    expect(esFechaFutura(hace(-minutos), AHORA)).toBe(futura);
  });
});
