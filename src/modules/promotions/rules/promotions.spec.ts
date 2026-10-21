import {
  clasificarPromocion,
  coincideConEstado,
  ordenarPromociones,
  type PromocionEvaluable,
} from './promotions.js';

const AHORA = new Date('2026-10-03T15:00:00Z'); // 12:00 en Buenos Aires
const DIA = 24 * 60 * 60 * 1000;
const en = (ms: number) => new Date(AHORA.getTime() + ms);

const p = (extra: Partial<PromocionEvaluable> = {}): PromocionEvaluable => ({
  id: 'pro-1',
  activa: true,
  desde: en(-DIA),
  hasta: en(10 * DIA),
  ...extra,
});

describe('PRD §3 — Estado de una promoción (R4, R5)', () => {
  it.each([
    ['vigente en el medio', p(), 'vigente'],
    ['vigente justo en `desde`', p({ desde: AHORA }), 'vigente'],
    ['vigente justo en `hasta`', p({ hasta: AHORA }), 'vigente'],
    ['vencida un milisegundo después de `hasta`', p({ hasta: en(-1) }), 'vencida'],
    ['próxima: empieza un milisegundo después', p({ desde: en(1) }), 'proxima'],
    ['dada de baja aunque esté en fecha', p({ activa: false }), 'baja'],
    ['dada de baja y vencida: sigue siendo baja', p({ activa: false, hasta: en(-DIA) }), 'baja'],
  ] as const)('%s', (_n, promo, esperado) => {
    expect(clasificarPromocion(promo, AHORA)).toBe(esperado);
  });
});

describe('PRD §3 — Qué promos entran en cada estado (R5, D4)', () => {
  it.each([
    ['vigentes', p(), true],
    ['vigentes', p({ desde: en(DIA) }), false],
    ['vigentes', p({ hasta: en(-1) }), false],
    ['vigentes', p({ activa: false }), false],
    ['por-vencer', p({ hasta: en(3 * DIA) }), true],
    ['por-vencer', p({ hasta: en(3 * DIA + 1) }), false],
    ['por-vencer', p({ hasta: AHORA }), true],
    ['por-vencer', p({ hasta: en(-1) }), false],
    ['por-vencer', p({ desde: en(DIA), hasta: en(2 * DIA) }), false],
    ['proximas', p({ desde: en(7 * DIA), hasta: en(20 * DIA) }), true],
    ['proximas', p({ desde: en(7 * DIA + 1), hasta: en(20 * DIA) }), false],
    ['proximas', p({ desde: en(1), hasta: en(20 * DIA) }), true],
    ['proximas', p({ desde: AHORA }), false],
    ['proximas', p({ desde: en(DIA), activa: false }), false],
  ] as const)('%s con %j → %s', (estado, promo, esperado) => {
    expect(coincideConEstado(promo, estado, AHORA)).toBe(esperado);
  });
});

describe('PRD §3 — Orden de las promociones (R5)', () => {
  const a = p({ id: 'pro-a', desde: en(3 * DIA), hasta: en(9 * DIA) });
  const b = p({ id: 'pro-b', desde: en(1 * DIA), hasta: en(5 * DIA) });
  const c = p({ id: 'pro-c', desde: en(1 * DIA), hasta: en(5 * DIA) });

  it('vigentes y por vencer: por `hasta` ascendente, desempata por id', () => {
    expect(ordenarPromociones([a, c, b], 'vigentes').map((x) => x.id)).toEqual([
      'pro-b',
      'pro-c',
      'pro-a',
    ]);
    expect(ordenarPromociones([a, c, b], 'por-vencer').map((x) => x.id)).toEqual([
      'pro-b',
      'pro-c',
      'pro-a',
    ]);
  });

  it('próximas: por `desde` ascendente, desempata por id', () => {
    expect(ordenarPromociones([a, c, b], 'proximas').map((x) => x.id)).toEqual([
      'pro-b',
      'pro-c',
      'pro-a',
    ]);
  });
});
