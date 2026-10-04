import { leerSimulacion } from './simulacion.js';

describe('AGENTS §11.4 — Cabecera X-Simular', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['error-500', { tipo: 'error' }],
    ['ERROR-500', { tipo: 'error' }],
    ['demora-3000', { tipo: 'demora', ms: 3000 }],
    ['demora-999999', { tipo: 'demora', ms: 30000 }],
    ['demora-', null],
    ['otra-cosa', null],
  ])('%s', (cabecera, esperado) => {
    expect(leerSimulacion(cabecera)).toEqual(esperado);
  });
});
