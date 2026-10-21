import { RelojFijo, RelojSistema } from './clock.js';

describe('AGENTS §6 — Reloj', () => {
  it('RelojFijo devuelve siempre el mismo instante y se puede mover', () => {
    const reloj = new RelojFijo('2026-10-03T12:00:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2026-10-03T15:00:00.000Z');
    reloj.avanzar(60_000);
    expect(reloj.ahora().toISOString()).toBe('2026-10-03T15:01:00.000Z');
    reloj.fijar('2026-12-31T23:59:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2027-01-01T02:59:00.000Z');
  });

  it('modificar el Date devuelto no mueve el reloj', () => {
    const reloj = new RelojFijo('2026-10-03T12:00:00-03:00');
    reloj.ahora().setFullYear(1999);
    expect(reloj.ahora().getUTCFullYear()).toBe(2026);
  });

  it('RelojSistema da la hora de la máquina', () => {
    const antes = new RelojSistema().ahora().getTime();
    expect(Math.abs(new RelojSistema().ahora().getTime() - antes)).toBeLessThan(1000);
  });
});
