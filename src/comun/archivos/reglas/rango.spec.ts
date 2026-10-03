import { parsearRango } from './rango.js';

describe('AGENTS §8 — Cabecera Range para audio y video', () => {
  it.each([
    [undefined, 100, null],
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=0-0', 100, { inicio: 0, fin: 0 }],
    ['bytes=90-', 100, { inicio: 90, fin: 99 }],
    ['bytes=-1', 100, { inicio: 99, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=50-500', 100, { inicio: 50, fin: 99 }],
    // Sintaxis que no entendemos: se ignora y va el archivo entero.
    ['bytes=abc', 100, null],
    ['items=0-10', 100, null],
    ['bytes=0-10,20-30', 100, null],
    ['bytes=20-10', 100, null],
    // Fuera del archivo: no se puede satisfacer.
    ['bytes=100-', 100, 'no-satisfacible'],
    ['bytes=150-200', 100, 'no-satisfacible'],
    ['bytes=-0', 100, 'no-satisfacible'],
    ['bytes=0-', 0, 'no-satisfacible'],
  ])('%s sobre %i bytes → %j', (cabecera, total, esperado) => {
    expect(parsearRango(cabecera, total)).toEqual(esperado);
  });
});
