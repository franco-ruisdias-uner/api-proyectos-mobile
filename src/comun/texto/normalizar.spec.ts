import { normalizarEmail, normalizarTexto } from './normalizar.js';

describe('AGENTS §5.5 — Texto normalizado para buscar igual en los cuatro motores', () => {
  it.each([
    ['Colón', 'colon'],
    ['  Parque   Berduc ', 'parque berduc'],
    ['FÚTBOL 5', 'futbol 5'],
    ['Peñarol', 'penarol'],
  ])('%s → %s', (texto, esperado) => {
    expect(normalizarTexto(texto)).toBe(esperado);
  });

  it('el email se guarda sin espacios y en minúsculas', () => {
    expect(normalizarEmail('  Emiliano@Mail.COM ')).toBe('emiliano@mail.com');
  });
});
