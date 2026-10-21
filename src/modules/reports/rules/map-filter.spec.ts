import { describe, expect, it } from 'vitest';
import { problemaDelFiltroGeografico } from './map-filter.js';

describe('PRD §3 — filtros geográficos del mapa', () => {
  it.each([
    [{}],
    [{ latitud: -33, longitud: -58, radioMetros: 100 }],
    [{ norte: -33, sur: -34, este: -58, oeste: -59 }],
    [{ norte: -33, sur: -33, este: -58, oeste: -58 }],
    [
      {
        latitud: -33,
        longitud: -58,
        radioMetros: 1,
        norte: -33,
        sur: -34,
        este: -58,
        oeste: -59,
      },
    ],
  ])('%j es válido', (f) => {
    expect(problemaDelFiltroGeografico(f)).toBeNull();
  });

  it.each([
    [{ latitud: -33 }],
    [{ longitud: -58 }],
    [{ radioMetros: 10 }],
    [{ latitud: -33, longitud: -58 }],
    [{ norte: -33, sur: -34, este: -58 }],
    [{ sur: -34 }],
    [{ norte: -34, sur: -33, este: -58, oeste: -59 }],
    [{ norte: -33, sur: -34, este: -59, oeste: -58 }],
  ])('%j es inválido y explica por qué', (f) => {
    expect(problemaDelFiltroGeografico(f)).toEqual(expect.any(String));
  });
});
