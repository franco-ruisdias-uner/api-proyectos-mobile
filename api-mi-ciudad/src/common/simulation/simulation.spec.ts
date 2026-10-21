import { leerSimulacion } from './simulation.js';

describe('AGENTS §11.4 — Cabecera X-Simular', () => {
  it.each([
    ['error-500', { tipo: 'error' }],
    ['demora-3000', { tipo: 'demora', milisegundos: 3000 }],
    ['demora-0', { tipo: 'demora', milisegundos: 0 }],
    ['demora-999999', { tipo: 'demora', milisegundos: 30000 }],
    ['cualquier-cosa', null],
    [undefined, null],
    ['', null],
  ])('%s', (cabecera, esperado) => {
    expect(leerSimulacion(cabecera)).toEqual(esperado);
  });
});
