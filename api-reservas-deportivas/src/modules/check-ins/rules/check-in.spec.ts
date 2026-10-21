import { decidirAusente, decidirIngreso } from './check-in.js';

const iso = (s: string): Date => new Date(s);
// Turno del sábado 19/09/2026, 19:00 a 20:00 (hora argentina).
const base = {
  estado: 'confirmada' as const,
  espacioId: 'esp-02',
  espacioPedido: 'esp-02',
  fecha: '2026-09-19',
  inicio: '19:00',
};

describe('PRD §4 / R14 — validar el código en la puerta', () => {
  it.each([
    ['30 minutos antes (borde)', '2026-09-19T18:30:00-03:00', null],
    [
      '29 minutos antes del borde: 31 minutos antes',
      '2026-09-19T18:29:59-03:00',
      'FUERA_DE_HORARIO',
    ],
    ['justo al inicio', '2026-09-19T19:00:00-03:00', null],
    ['un segundo antes del fin', '2026-09-19T19:59:59-03:00', null],
    ['justo al fin', '2026-09-19T20:00:00-03:00', 'FUERA_DE_HORARIO'],
  ])('%s', (_n, ahora, esperado) => {
    expect(
      decidirIngreso({ ...base, ingresoEn: null, ahora: iso(ahora) }),
    ).toBe(esperado);
  });

  it('el orden: cancelada > otro día > otro espacio > ya ingresó > horario', () => {
    const ahora = iso('2026-09-19T10:00:00-03:00');
    const caso = (p: object) =>
      decidirIngreso({ ...base, ingresoEn: null, ahora, ...p });
    expect(
      caso({
        estado: 'cancelada',
        fecha: '2026-09-20',
        espacioPedido: 'esp-03',
      }),
    ).toBe('RESERVA_CANCELADA');
    expect(caso({ fecha: '2026-09-20', espacioPedido: 'esp-03' })).toBe(
      'CODIGO_DE_OTRO_DIA',
    );
    expect(caso({ espacioPedido: 'esp-03' })).toBe('CODIGO_DE_OTRO_ESPACIO');
    expect(caso({ estado: 'cumplida' })).toBe('INGRESO_YA_REGISTRADO');
    expect(caso({})).toBe('FUERA_DE_HORARIO');
  });

  it('"hoy" es el día argentino: 23:30 del 19 en Villaguay es 02:30Z del 20', () => {
    const r = decidirIngreso({
      ...base,
      inicio: '23:00',
      ingresoEn: null,
      ahora: iso('2026-09-20T02:30:00Z'),
    });
    expect(r).toBeNull();
  });

  it('una reserva ausente no puede ingresar', () => {
    expect(
      decidirIngreso({
        ...base,
        estado: 'ausente',
        ingresoEn: null,
        ahora: iso('2026-09-19T19:30:00-03:00'),
      }),
    ).toBe('RESERVA_AUSENTE');
  });
});

describe('PRD §4 / R15 — marcar ausente', () => {
  it.each([
    [
      '14:59 después del inicio',
      '2026-09-19T19:14:59-03:00',
      'ANTES_DE_TIEMPO',
    ],
    ['15 minutos después (borde)', '2026-09-19T19:15:00-03:00', null],
    ['mucho después', '2026-09-20T10:00:00-03:00', null],
  ])('%s', (_n, ahora, error) => {
    const r = decidirAusente({ ...base, ahora: iso(ahora) });
    expect('error' in r ? r.error : null).toBe(error);
  });

  it('según el estado', () => {
    const ahora = iso('2026-09-19T21:00:00-03:00');
    expect(decidirAusente({ ...base, estado: 'ausente', ahora })).toEqual({
      accion: 'sin-cambios',
    });
    expect(decidirAusente({ ...base, estado: 'cancelada', ahora })).toEqual({
      error: 'RESERVA_CANCELADA',
    });
    expect(decidirAusente({ ...base, estado: 'cumplida', ahora })).toEqual({
      error: 'INGRESO_YA_REGISTRADO',
    });
    expect(decidirAusente({ ...base, ahora })).toEqual({ accion: 'marcar' });
  });
});
