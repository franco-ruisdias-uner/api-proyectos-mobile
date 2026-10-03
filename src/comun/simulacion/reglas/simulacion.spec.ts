import { interpretarSimulacion } from './simulacion.js';

describe('AGENTS §11.4 — Cabecera X-Simular', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['error-500', { tipo: 'error' }],
    ['ERROR-500', { tipo: 'error' }],
    ['demora-3000', { tipo: 'demora', milisegundos: 3000 }],
    ['demora-0', { tipo: 'demora', milisegundos: 0 }],
    ['demora-999999', { tipo: 'demora', milisegundos: 30000 }],
    ['demora-abc', null],
    ['otra-cosa', null],
  ])('%j → %j', (cabecera, esperado) => {
    expect(interpretarSimulacion(cabecera)).toEqual(esperado);
  });
});
