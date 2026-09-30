import { seleccionarParadas } from './seleccion-de-paradas.js';

const p = (id: string, nombreBusqueda: string, latitud: number, longitud: number) => ({
  id,
  nombreBusqueda,
  latitud,
  longitud,
});

// Desde el centro (-31.7333, -60.5241): b a ~100 m, c a ~1,1 km, a a ~2,2 km.
const a = p('par-a', 'zeta', -31.7333, -60.5241 + 0.0233);
const b = p('par-b', 'alameda', -31.7333, -60.5241 + 0.00105);
const c = p('par-c', 'almafuerte', -31.7333 + 0.01, -60.5241);
const centro = { latitud: -31.7333, longitud: -60.5241 };

describe('Espec. M1 — paradas cercanas y orden', () => {
  it('por nombre, y si empatan, por id', () => {
    const d = p('par-d', 'alameda', -31.7, -60.5);
    expect(seleccionarParadas([a, c, d, b], { orden: 'nombre' }).map((x) => x.id)).toEqual([
      'par-b',
      'par-d',
      'par-c',
      'par-a',
    ]);
  });

  it('por distancia, de la más cercana a la más lejana', () => {
    const r = seleccionarParadas([a, c, b], { orden: 'distancia', centro });
    expect(r.map((x) => x.id)).toEqual(['par-b', 'par-c', 'par-a']);
  });

  it('con radio, deja sólo las que están dentro (y el borde entra)', () => {
    const r = seleccionarParadas([a, c, b], { orden: 'nombre', centro, radioMetros: 1500 });
    expect(r.map((x) => x.id)).toEqual(['par-b', 'par-c']);
    expect(seleccionarParadas([a, c, b], { orden: 'nombre', centro, radioMetros: 50 })).toEqual([]);
  });

  it('sin centro no filtra por distancia', () => {
    expect(seleccionarParadas([a, b], { orden: 'nombre' })).toHaveLength(2);
  });

  it('no modifica la lista que recibe', () => {
    const entrada = [a, b];
    seleccionarParadas(entrada, { orden: 'nombre' });
    expect(entrada).toEqual([a, b]);
  });
});
