import { leerRango } from './rango.js';

describe('AGENTS §8 — Cabecera Range para audio y video', () => {
  it.each([
    [undefined, 100, null],
    ['', 100, null],
    ['items=0-10', 100, null],
    ['bytes=-', 100, null],
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=0-0', 100, { inicio: 0, fin: 0 }],
    ['bytes=90-', 100, { inicio: 90, fin: 99 }],
    ['bytes=90-500', 100, { inicio: 90, fin: 99 }],
    ['bytes=-10', 100, { inicio: 90, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=99-99', 100, { inicio: 99, fin: 99 }],
    ['bytes=100-', 100, 'insatisfacible'],
    ['bytes=20-10', 100, 'insatisfacible'],
    ['bytes=-0', 100, 'insatisfacible'],
    ['bytes=0-', 0, 'insatisfacible'],
  ])('%s sobre %i bytes', (cabecera, total, esperado) => {
    expect(leerRango(cabecera, total)).toEqual(esperado);
  });
});
