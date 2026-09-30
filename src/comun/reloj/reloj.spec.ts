import { RelojFijo } from './reloj.js';

describe('AGENTS §6 — RelojFijo para tests y demos', () => {
  it('devuelve siempre el mismo instante hasta que se lo mueve', () => {
    const reloj = new RelojFijo('2026-11-14T23:59:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2026-11-15T02:59:00.000Z');
    reloj.avanzar(60_000);
    expect(reloj.ahora().toISOString()).toBe('2026-11-15T03:00:00.000Z');
    reloj.fijar('2026-12-31T23:59:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2027-01-01T02:59:00.000Z');
  });

  it('ahora() devuelve una copia: modificarla no mueve el reloj', () => {
    const reloj = new RelojFijo('2026-11-14T10:00:00-03:00');
    reloj.ahora().setFullYear(2000);
    expect(reloj.ahora().getUTCFullYear()).toBe(2026);
  });
});
