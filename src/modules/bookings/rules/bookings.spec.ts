import {
  cancelableHasta,
  codigoQrDe,
  corteDeProximas,
  decidirCancelacion,
  esActiva,
  finDelTurno,
  inicioDelTurno,
} from './bookings.js';

const iso = (d: Date): string => d.toISOString();

describe('PRD §3 — Cancelable hasta cuatro horas antes (R10)', () => {
  it.each([
    ['2026-09-19', '19:00', '2026-09-19T18:00:00.000Z'], // 15:00 -03:00
    ['2026-09-19', '08:00', '2026-09-19T07:00:00.000Z'], // 04:00 -03:00
    ['2026-09-19', '23:00', '2026-09-19T22:00:00.000Z'],
    ['2026-09-20', '08:00', '2026-09-20T07:00:00.000Z'],
  ])('%s %s → %s', (fecha, inicio, esperado) => {
    expect(iso(cancelableHasta(fecha, inicio))).toBe(esperado);
  });

  it('inicio y fin del turno (el último termina a medianoche)', () => {
    expect(iso(inicioDelTurno('2026-09-19', '19:00'))).toBe(
      '2026-09-19T22:00:00.000Z',
    );
    expect(iso(finDelTurno('2026-09-19', '23:00'))).toBe(
      '2026-09-20T03:00:00.000Z',
    );
  });
});

describe('D2 — Código QR legible', () => {
  it('VGY-<MMDD>-<HH>-<6 caracteres>', () => {
    expect(codigoQrDe('2026-09-19', '19:00', 'K3X9QM')).toBe(
      'VGY-0919-19-K3X9QM',
    );
    expect(codigoQrDe('2026-12-31', '08:00', 'AAAAAA')).toBe(
      'VGY-1231-08-AAAAAA',
    );
  });
});

describe('PRD §3 — Una reserva activa es una confirmada cuyo turno no terminó (R9)', () => {
  const r = (estado: 'confirmada' | 'cancelada' | 'cumplida' | 'ausente') => ({
    estado,
    fecha: '2026-09-19',
    inicio: '19:00',
  });
  it.each([
    ['confirmada', '2026-09-19T18:59:59-03:00', true],
    ['confirmada', '2026-09-19T19:30:00-03:00', true], // en curso
    ['confirmada', '2026-09-19T19:59:59-03:00', true],
    ['confirmada', '2026-09-19T20:00:00-03:00', false], // terminó
    ['cancelada', '2026-09-19T10:00:00-03:00', false],
    ['cumplida', '2026-09-19T10:00:00-03:00', false],
    ['ausente', '2026-09-19T10:00:00-03:00', false],
  ] as const)('%s a las %s → %s', (estado, ahora, activa) => {
    expect(esActiva(r(estado), new Date(ahora))).toBe(activa);
  });
});

describe('Corte de próximas/pasadas en hora argentina', () => {
  it.each([
    ['2026-09-19T19:00:00-03:00', '2026-09-19', '18:00'],
    ['2026-09-19T19:00:30-03:00', '2026-09-19', '18:00'],
    ['2026-09-19T18:59:59-03:00', '2026-09-19', '17:59'],
    ['2026-09-20T00:30:00-03:00', '2026-09-19', '23:30'],
    ['2026-09-19T23:30:00-03:00', '2026-09-19', '22:30'],
    ['2026-09-20T02:30:00Z', '2026-09-19', '22:30'], // 23:30 en Villaguay
  ])('%s → %s %s', (ahora, dia, hora) => {
    expect(corteDeProximas(new Date(ahora))).toEqual({ dia, hora });
  });
});

describe('PRD §3 — Cancelar: dueño dentro del plazo, encargado siempre (R12)', () => {
  const base = { fecha: '2026-09-19', inicio: '19:00' };
  const dueno = { esDueno: true, esPersonal: false };
  const personal = { esDueno: false, esPersonal: true };

  it.each([
    // [descripción, estado, ahora, quién, resultado]
    [
      'dueño con tiempo',
      'confirmada',
      '2026-09-19T15:00:00-03:00',
      dueno,
      { accion: 'cancelar', tardia: false },
    ],
    [
      'dueño justo en el límite',
      'confirmada',
      '2026-09-19T15:00:00-03:00',
      dueno,
      { accion: 'cancelar', tardia: false },
    ],
    [
      'dueño un segundo tarde',
      'confirmada',
      '2026-09-19T15:00:01-03:00',
      dueno,
      { error: 'CANCELACION_FUERA_DE_PLAZO' },
    ],
    [
      'dueño con el turno empezado',
      'confirmada',
      '2026-09-19T19:10:00-03:00',
      dueno,
      { error: 'CANCELACION_FUERA_DE_PLAZO' },
    ],
    [
      'encargado fuera de plazo: tardía',
      'confirmada',
      '2026-09-19T17:00:00-03:00',
      personal,
      { accion: 'cancelar', tardia: true },
    ],
    [
      'encargado con tiempo: no es tardía',
      'confirmada',
      '2026-09-19T10:00:00-03:00',
      personal,
      { accion: 'cancelar', tardia: false },
    ],
    [
      'encargado con el turno empezado',
      'confirmada',
      '2026-09-19T19:10:00-03:00',
      personal,
      { error: 'RESERVA_NO_CANCELABLE' },
    ],
    [
      'ya cancelada (dueño)',
      'cancelada',
      '2026-09-19T17:00:00-03:00',
      dueno,
      { accion: 'sin-cambios' },
    ],
    [
      'ya cancelada (encargado)',
      'cancelada',
      '2026-09-19T19:10:00-03:00',
      personal,
      { accion: 'sin-cambios' },
    ],
    [
      'cumplida (dueño)',
      'cumplida',
      '2026-09-19T10:00:00-03:00',
      dueno,
      { error: 'RESERVA_NO_CANCELABLE' },
    ],
    [
      'ausente (encargado)',
      'ausente',
      '2026-09-19T10:00:00-03:00',
      personal,
      { error: 'RESERVA_NO_CANCELABLE' },
    ],
  ] as const)('%s', (_d, estado, ahora, quien, esperado) => {
    expect(
      decidirCancelacion({ ...base, estado, ahora: new Date(ahora), ...quien }),
    ).toEqual(esperado);
  });
});
