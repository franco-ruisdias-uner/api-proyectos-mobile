import { RelojFijo } from './reloj.js';

describe('AGENTS §6 — RelojFijo', () => {
  it('devuelve siempre el mismo instante hasta que se mueve', () => {
    const reloj = new RelojFijo('2026-09-19T10:00:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2026-09-19T13:00:00.000Z');
    reloj.avanzarMinutos(90);
    expect(reloj.ahora().toISOString()).toBe('2026-09-19T14:30:00.000Z');
    reloj.fijar('2026-12-31T23:59:00-03:00');
    expect(reloj.ahora().toISOString()).toBe('2027-01-01T02:59:00.000Z');
  });

  it('cada llamada devuelve un Date nuevo (no se puede modificar desde afuera)', () => {
    const reloj = new RelojFijo('2026-09-19T10:00:00-03:00');
    reloj.ahora().setFullYear(2000);
    expect(reloj.ahora().getUTCFullYear()).toBe(2026);
  });

  it('rechaza un instante inválido', () => {
    expect(() => new RelojFijo('no es fecha')).toThrow();
  });
});
