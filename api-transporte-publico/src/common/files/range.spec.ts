import { interpretarRango } from './range.js';

describe('AGENTS §8 — cabecera Range para audio y video', () => {
  it.each([
    [undefined, 100, null],
    ['bytes=0-9', 100, { inicio: 0, fin: 9 }],
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=90-', 100, { inicio: 90, fin: 99 }],
    ['bytes=-10', 100, { inicio: 90, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=50-5000', 100, { inicio: 50, fin: 99 }],
    ['bytes=99-99', 100, { inicio: 99, fin: 99 }],
    // RFC 9110 §14.2: una cabecera que no se entiende, o con varios rangos, se ignora.
    ['bytes=20-10', 100, null],
    ['bytes=abc', 100, null],
    ['bytes=', 100, null],
    ['items=0-9', 100, null],
    ['bytes=0-1,5-6', 100, null],
  ])('%j sobre %i bytes → %j', (cabecera, total, esperado) => {
    expect(interpretarRango(cabecera, total)).toEqual(esperado);
  });

  it.each([
    ['bytes=100-', 100],
    ['bytes=5000-6000', 100],
    ['bytes=-0', 100],
    ['bytes=0-0', 0],
  ])('%j sobre %i bytes no se puede satisfacer (416)', (cabecera, total) => {
    expect(interpretarRango(cabecera, total)).toBe('invalido');
  });
});
