import type { HorarioConTemporada } from '../place-to-load.js';
import { actualizadoEnVigente, horariosVigentes, inicioDeTemporada, temporadaEn } from './hours.js';

describe('D1 — Temporada de verano (1/12 al 31/3) e invierno, en hora de Buenos Aires', () => {
  it.each([
    ['2026-11-30T23:59:59-03:00', 'invierno'],
    ['2026-12-01T00:00:00-03:00', 'verano'],
    ['2026-12-31T23:59:59-03:00', 'verano'],
    ['2027-01-01T00:00:00-03:00', 'verano'],
    ['2027-02-28T12:00:00-03:00', 'verano'],
    ['2027-03-31T23:59:59-03:00', 'verano'],
    ['2027-04-01T00:00:00-03:00', 'invierno'],
    ['2026-07-09T12:00:00-03:00', 'invierno'],
    // 02:30 UTC del 1/12 todavía es 30/11 en Buenos Aires.
    ['2026-12-01T02:30:00Z', 'invierno'],
    ['2026-12-01T03:00:00Z', 'verano'],
  ])('%s → %s', (ahora, temporada) => {
    expect(temporadaEn(new Date(ahora))).toBe(temporada);
  });
});

describe('D1 — Comienzo de la temporada vigente', () => {
  it.each([
    ['2026-12-01T00:00:00-03:00', '2026-12-01T00:00:00-03:00'],
    ['2026-12-31T23:59:00-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-01-15T10:00:00-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-03-31T23:59:59-03:00', '2026-12-01T00:00:00-03:00'],
    ['2027-04-01T00:00:00-03:00', '2027-04-01T00:00:00-03:00'],
    ['2026-11-30T23:59:59-03:00', '2026-04-01T00:00:00-03:00'],
  ])('%s → %s', (ahora, inicio) => {
    expect(inicioDeTemporada(new Date(ahora)).getTime()).toBe(new Date(inicio).getTime());
  });
});

describe('R2 y R3 — Horarios vigentes: un elemento por tramo, sólo los de la temporada de hoy', () => {
  const horarios: HorarioConTemporada[] = [
    { dia: 6, abre: '16:00', cierra: '20:00', temporada: 'todo-el-anio' },
    { dia: 6, abre: '09:00', cierra: '12:00', temporada: 'todo-el-anio' },
    { dia: 1, abre: '08:00', cierra: '22:00', temporada: 'verano' },
    { dia: 1, abre: '09:00', cierra: '19:00', temporada: 'invierno' },
    { dia: 0, abre: '10:00', cierra: '13:00', temporada: 'verano' },
  ];

  it('en invierno: los de todo el año y los de invierno, por día y hora, sin la temporada', () => {
    expect(horariosVigentes(horarios, new Date('2026-07-01T12:00:00-03:00'))).toEqual([
      { dia: 1, abre: '09:00', cierra: '19:00' },
      { dia: 6, abre: '09:00', cierra: '12:00' },
      { dia: 6, abre: '16:00', cierra: '20:00' },
    ]);
  });

  it('en verano: los de todo el año y los de verano', () => {
    expect(horariosVigentes(horarios, new Date('2027-01-10T12:00:00-03:00'))).toEqual([
      { dia: 0, abre: '10:00', cierra: '13:00' },
      { dia: 1, abre: '08:00', cierra: '22:00' },
      { dia: 6, abre: '09:00', cierra: '12:00' },
      { dia: 6, abre: '16:00', cierra: '20:00' },
    ]);
  });

  it('sin horarios: lista vacía (cerrado todos los días)', () => {
    expect(horariosVigentes([], new Date('2027-01-10T12:00:00-03:00'))).toEqual([]);
  });

  it('un tramo que cruza la medianoche se devuelve tal cual (el teléfono calcula si está abierto)', () => {
    const noche: HorarioConTemporada[] = [
      { dia: 5, abre: '20:30', cierra: '01:00', temporada: 'todo-el-anio' },
    ];
    expect(horariosVigentes(noche, new Date('2026-07-01T12:00:00-03:00'))).toEqual([
      { dia: 5, abre: '20:30', cierra: '01:00' },
    ]);
  });
});

describe('D1 — actualizadoEn de un lugar con horario de temporada', () => {
  const ahora = new Date('2026-12-05T10:00:00-03:00');

  it('sin temporadas, es el de la base', () => {
    const base = new Date('2026-08-01T10:30:00-03:00');
    expect(actualizadoEnVigente(base, false, ahora)).toEqual(base);
  });

  it('con temporadas, el comienzo de la temporada si es posterior', () => {
    const base = new Date('2026-08-01T10:30:00-03:00');
    expect(actualizadoEnVigente(base, true, ahora)).toEqual(new Date('2026-12-01T00:00:00-03:00'));
  });

  it('con temporadas, el de la base si se editó después de que empezó la temporada', () => {
    const base = new Date('2026-12-03T10:30:00-03:00');
    expect(actualizadoEnVigente(base, true, ahora)).toEqual(base);
  });
});
