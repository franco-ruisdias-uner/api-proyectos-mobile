import { coincideConEstado, esProximo, esVigente, ventanaAlFinalizar } from './validity.js';

const t = (iso: string) => new Date(iso);
const AHORA = t('2026-09-19T13:30:00Z');

describe('Espec. R10 — vigencia de un aviso', () => {
  it.each([
    ['empezó y no tiene fin', '2026-09-19T13:00:00Z', null, true],
    ['empieza justo ahora', '2026-09-19T13:30:00Z', null, true],
    ['empieza dentro de un segundo', '2026-09-19T13:30:01Z', null, false],
    [
      'terminó justo ahora (hasta > ahora es falso)',
      '2026-09-18T00:00:00Z',
      '2026-09-19T13:30:00Z',
      false,
    ],
    ['termina dentro de un segundo', '2026-09-18T00:00:00Z', '2026-09-19T13:30:01Z', true],
    ['ya terminó', '2026-09-10T00:00:00Z', '2026-09-11T00:00:00Z', false],
    ['es futuro', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z', false],
  ])('%s', (_caso, desde, hasta, vigente) => {
    expect(esVigente({ desde: t(desde), hasta: hasta ? t(hasta) : null }, AHORA)).toBe(vigente);
  });

  it.each([
    ['desde > ahora', '2026-09-19T13:30:01Z', true],
    ['desde = ahora ya es vigente, no próximo', '2026-09-19T13:30:00Z', false],
    ['desde pasado', '2026-09-01T00:00:00Z', false],
  ])('próximo: %s', (_caso, desde, proximo) => {
    expect(esProximo({ desde: t(desde), hasta: null }, AHORA)).toBe(proximo);
  });

  it('el estado «todos» incluye hasta lo terminado', () => {
    const terminado = { desde: t('2026-09-01T00:00:00Z'), hasta: t('2026-09-02T00:00:00Z') };
    expect(coincideConEstado(terminado, 'todos', AHORA)).toBe(true);
    expect(coincideConEstado(terminado, 'vigentes', AHORA)).toBe(false);
    expect(coincideConEstado(terminado, 'proximos', AHORA)).toBe(false);
  });
});

describe('Espec. §4 — finalizar un aviso', () => {
  it('un vigente sin fin termina ahora', () => {
    const r = ventanaAlFinalizar({ desde: t('2026-09-19T00:00:00Z'), hasta: null }, AHORA);
    expect(r).toEqual({ desde: t('2026-09-19T00:00:00Z'), hasta: AHORA });
  });
  it('un vigente con fin futuro lo adelanta', () => {
    const r = ventanaAlFinalizar(
      { desde: t('2026-09-19T00:00:00Z'), hasta: t('2026-10-01T00:00:00Z') },
      AHORA,
    );
    expect(r.hasta).toEqual(AHORA);
  });
  it('uno próximo se cancela: desde y hasta quedan en ahora', () => {
    const r = ventanaAlFinalizar({ desde: t('2026-09-20T00:00:00Z'), hasta: null }, AHORA);
    expect(r).toEqual({ desde: AHORA, hasta: AHORA });
  });
  it('uno que ya terminó queda como estaba', () => {
    const ventana = { desde: t('2026-09-01T00:00:00Z'), hasta: t('2026-09-02T00:00:00Z') };
    expect(ventanaAlFinalizar(ventana, AHORA)).toBe(ventana);
  });
});
