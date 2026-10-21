import { validarVentana } from './validate-notice.js';

const t = (iso: string) => new Date(iso);

describe('Espec. R11 — `hasta`, si viene, posterior a `desde`', () => {
  it.each([
    ['sin hasta', '2026-09-19T00:00:00Z', null, true],
    ['hasta posterior', '2026-09-19T00:00:00Z', '2026-09-19T00:00:01Z', true],
    ['hasta igual', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z', false],
    ['hasta anterior', '2026-09-19T00:00:00Z', '2026-09-18T00:00:00Z', false],
  ])('%s', (_caso, desde, hasta, valida) => {
    expect(validarVentana(t(desde), hasta ? t(hasta) : null)).toBe(valida);
  });
});
