import { validarHoras } from './hours.js';

describe('PRD §6 / R17 y R19 — Horas en punto entre 08:00 y 24:00, inicio < fin', () => {
  it.each([
    ['08:00', '09:00', null],
    ['08:00', '24:00', null],
    ['23:00', '24:00', null],
    ['21:00', '23:00', null],
  ])('%s a %s es válido', (inicio, fin, esperado) => {
    expect(validarHoras(inicio, fin)).toBe(esperado);
  });

  it.each([
    ['07:00', '09:00'],
    ['08:30', '10:00'],
    ['08:00', '09:30'],
    ['10:00', '10:00'],
    ['11:00', '10:00'],
    ['08:00', '25:00'],
    ['24:00', '24:00'],
    ['8:00', '9:00'],
    ['08:00', ''],
  ])('%s a %s se rechaza con un mensaje', (inicio, fin) => {
    expect(validarHoras(inicio, fin)).toEqual(expect.any(String));
  });
});
