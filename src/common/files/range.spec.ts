import { parsearRango } from './range.js';

describe('AGENTS §8 — Cabecera Range (bytes)', () => {
  it.each([
    ['bytes=10-19', 100, { inicio: 10, fin: 19 }],
    ['bytes=0-0', 100, { inicio: 0, fin: 0 }],
    ['bytes=90-', 100, { inicio: 90, fin: 99 }],
    ['bytes=-10', 100, { inicio: 90, fin: 99 }],
    ['bytes=-500', 100, { inicio: 0, fin: 99 }],
    ['bytes=50-5000', 100, { inicio: 50, fin: 99 }],
    ['bytes=99-99', 100, { inicio: 99, fin: 99 }],
  ])('%s sobre %i bytes', (cabecera, total, esperado) => {
    expect(parsearRango(cabecera, total)).toEqual(esperado);
  });

  it.each([
    ['sin cabecera', undefined],
    ['varios rangos', 'bytes=0-1,5-6'],
    ['otra unidad', 'items=0-1'],
    ['basura', 'bytes=abc'],
  ])('%s → archivo entero', (_caso, cabecera) => {
    expect(parsearRango(cabecera, 100)).toBe('entero');
  });

  it.each([
    ['empieza después del final', 'bytes=100-'],
    ['fin antes que inicio', 'bytes=20-10'],
    ['sufijo cero', 'bytes=-0'],
  ])('%s → no satisfacible', (_caso, cabecera) => {
    expect(parsearRango(cabecera, 100)).toBe('insatisfacible');
  });

  it('archivo vacío con rango → no satisfacible', () => {
    expect(parsearRango('bytes=0-', 0)).toBe('insatisfacible');
  });
});
