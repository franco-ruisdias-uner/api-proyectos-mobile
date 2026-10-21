import { horariosInvalidos, horariosSuperpuestos } from './hours.js';
import { sinRepetidos, ventanaDePromocion } from './panel.js';

const h = (dia: number, abre: string, cierra: string) => ({ dia: dia as 0, abre, cierra });

describe('ESPECIFICACION R2 — Horarios del comercio: un elemento por tramo', () => {
  it.each([
    ['tramos cortados del mismo día', [h(1, '08:00', '12:00'), h(1, '16:30', '20:30')], false],
    [
      'un tramo que empieza justo cuando termina el otro',
      [h(1, '08:00', '12:00'), h(1, '12:00', '13:00')],
      false,
    ],
    ['mismo horario en días distintos', [h(1, '08:00', '12:00'), h(2, '08:00', '12:00')], false],
    ['tramos que se pisan', [h(1, '08:00', '12:00'), h(1, '11:59', '13:00')], true],
    ['un tramo adentro de otro', [h(3, '08:00', '20:00'), h(3, '10:00', '11:00')], true],
    ['el mismo tramo repetido', [h(0, '09:00', '13:00'), h(0, '09:00', '13:00')], true],
    ['pisados y desordenados', [h(5, '16:00', '20:00'), h(5, '08:00', '17:00')], true],
    ['sin tramos', [], false],
  ])('%s → superpuestos: %s', (_nombre, horarios, esperado) => {
    expect(horariosSuperpuestos(horarios)).toBe(esperado);
  });

  it.each([
    ['abre antes que cierra', h(1, '08:00', '12:00'), null],
    ['abre igual que cierra', h(1, '08:00', '08:00'), 'abre'],
    ['abre después de cerrar', h(1, '20:00', '08:00'), 'abre'],
    ['hora 24:00', h(1, '08:00', '24:00'), 'formato'],
    ['minutos 60', h(1, '08:60', '12:00'), 'formato'],
    ['sin cero adelante', h(1, '8:00', '12:00'), 'formato'],
    ['23:59 es válida', h(1, '08:00', '23:59'), null],
  ])('%s', (_nombre, tramo, problema) => {
    expect(horariosInvalidos([tramo])).toBe(problema);
  });
});

describe('ESPECIFICACION R6 — Ventana de una promoción', () => {
  const ahora = new Date('2026-10-03T15:00:00Z');
  const en = (horas: number) => new Date(ahora.getTime() + horas * 3600_000);

  it.each([
    ['empezó ayer y termina en 10 días', en(-24), en(240), 'ok'],
    ['empieza mañana', en(24), en(48), 'ok'],
    ['termina antes de empezar', en(48), en(24), 'orden'],
    ['termina cuando empieza', en(24), en(24), 'orden'],
    ['ya terminó', en(-48), en(-1), 'vencida'],
    ['termina justo ahora', en(-48), ahora, 'vencida'],
    ['termina un segundo después', en(-48), new Date(ahora.getTime() + 1000), 'ok'],
  ])('%s → %s', (_nombre, desde, hasta, esperado) => {
    expect(ventanaDePromocion(desde, hasta, ahora)).toBe(esperado);
  });
});

describe('ESPECIFICACION D11 — Medios de pago', () => {
  it('saca los repetidos y mantiene el orden', () => {
    expect(sinRepetidos(['efectivo', 'debito', 'efectivo'])).toEqual(['efectivo', 'debito']);
  });
});
