import { leerRango } from './range.js';

describe('AGENTS §8 y R19 — Cabecera Range para adelantar audio y video', () => {
  it.each([
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=90-', 100, { inicio: 90, fin: 99 }],
    ['bytes=-1', 100, { inicio: 99, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=0-999', 100, { inicio: 0, fin: 99 }],
    ['bytes=99-99', 100, { inicio: 99, fin: 99 }],
  ])('%s de %i', (cabecera, total, esperado) => {
    expect(leerRango(cabecera, total)).toEqual(esperado);
  });

  it.each([
    ['bytes=100-', 100],
    ['bytes=50-10', 100],
    ['bytes=-0', 100],
  ])('%s de %i es insatisfacible', (cabecera, total) => {
    expect(leerRango(cabecera, total)).toBe('insatisfacible');
  });

  it.each([undefined, '', 'bytes=0-1,5-6', 'items=0-5', 'bytes=-'])('%s: archivo entero', (cabecera) => {
    expect(leerRango(cabecera, 100)).toBeUndefined();
  });
});
