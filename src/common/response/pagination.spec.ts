import { calcularPaginacion } from './pagination.js';

describe('AGENTS §4.2 — Paginación', () => {
  it('defaults: página 1, 20 por página', () => {
    expect(calcularPaginacion({})).toEqual({ pagina: 1, porPagina: 20, saltar: 0 });
  });

  it('calcula el salto', () => {
    expect(calcularPaginacion({ pagina: 3, porPagina: 10 })).toEqual({
      pagina: 3,
      porPagina: 10,
      saltar: 20,
    });
  });
});
