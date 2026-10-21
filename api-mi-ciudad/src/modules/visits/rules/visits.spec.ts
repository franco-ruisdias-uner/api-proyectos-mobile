import { estaEnElFuturo, normalizarNota } from './visits.js';

const AHORA = new Date('2026-11-14T15:00:00Z');

describe('PRD §4 / R14 — la fecha de una visita no puede estar en el futuro (tolerancia de 5 minutos)', () => {
  it.each([
    ['ahora mismo', 0, false],
    ['ayer', -86_400_000, false],
    ['4 minutos 59 segundos adelante', 299_000, false],
    ['justo 5 minutos adelante', 300_000, false],
    ['5 minutos y un segundo adelante', 301_000, true],
    ['mañana', 86_400_000, true],
  ])('%s', (_caso, desfase, esperado) => {
    expect(estaEnElFuturo(new Date(AHORA.getTime() + desfase), AHORA)).toBe(esperado);
  });
});

describe('R15 — la nota vacía se guarda como null', () => {
  it.each([
    ['Linda vista', 'Linda vista'],
    ['  con espacios  ', 'con espacios'],
    ['', null],
    ['   \n ', null],
    [null, null],
    [undefined, undefined],
  ])('%j → %j', (entrada, esperado) => {
    expect(normalizarNota(entrada)).toBe(esperado);
  });
});
