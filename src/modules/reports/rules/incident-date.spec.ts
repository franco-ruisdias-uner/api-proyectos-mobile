import { esFechaFutura, TOLERANCIA_RELOJ_MS } from './incident-date.js';

describe('R6 — La fecha del hecho no puede estar en el futuro (tolerancia de 5 minutos)', () => {
  const ahora = new Date('2026-09-14T13:00:00Z');
  it.each([
    ['ahora mismo', 0, false],
    ['una hora antes', -3_600_000, false],
    ['justo en el límite de tolerancia', TOLERANCIA_RELOJ_MS, false],
    ['un segundo pasado el límite', TOLERANCIA_RELOJ_MS + 1000, true],
    ['un día después', 86_400_000, true],
  ])('%s', (_caso, desfase, futura) => {
    expect(esFechaFutura(new Date(ahora.getTime() + desfase), ahora)).toBe(
      futura,
    );
  });
});
