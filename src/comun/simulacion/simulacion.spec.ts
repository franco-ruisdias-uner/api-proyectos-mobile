import { interpretarSimulacion } from './simulacion.js';

describe('AGENTS §11.4 — simulación de fallas con X-Simular', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['error-500', { tipo: 'error' }],
    ['demora-3000', { tipo: 'demora', milisegundos: 3000 }],
    ['demora-0', { tipo: 'demora', milisegundos: 0 }],
    ['demora-999999', { tipo: 'demora', milisegundos: 30000 }],
    ['demora-abc', null],
    ['error-404', null],
    ['cualquier-cosa', null],
  ])('%j → %j', (valor, esperado) => {
    expect(interpretarSimulacion(valor)).toEqual(esperado);
  });
});
