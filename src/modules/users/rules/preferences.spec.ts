import { mezclarPreferencias, preferenciasIniciales } from './preferences.js';

describe('Especificación §1 — Preferencias iniciales', () => {
  it('sin categorías, avisos de proximidad a 250 m, tema del sistema', () => {
    expect(preferenciasIniciales()).toEqual({
      categoriasFavoritas: [],
      avisarProximidad: true,
      radioAvisoMetros: 250,
      tema: 'sistema',
    });
  });
});

describe('R18 — preferencias se mezcla campo a campo', () => {
  const actuales = {
    categoriasFavoritas: ['cat-museos'],
    avisarProximidad: true,
    radioAvisoMetros: 250,
    tema: 'sistema' as const,
  };

  it('cambia sólo lo que vino', () => {
    expect(mezclarPreferencias(actuales, { tema: 'oscuro' })).toEqual({ ...actuales, tema: 'oscuro' });
  });

  it('false y listas vacías también son cambios', () => {
    expect(mezclarPreferencias(actuales, { avisarProximidad: false, categoriasFavoritas: [] })).toEqual({
      ...actuales,
      avisarProximidad: false,
      categoriasFavoritas: [],
    });
  });

  it('las categorías repetidas quedan una vez', () => {
    expect(
      mezclarPreferencias(actuales, { categoriasFavoritas: ['cat-playas', 'cat-museos', 'cat-playas'] })
        .categoriasFavoritas,
    ).toEqual(['cat-playas', 'cat-museos']);
  });

  it('no modifica el objeto original', () => {
    mezclarPreferencias(actuales, { tema: 'claro' });
    expect(actuales.tema).toBe('sistema');
  });
});
