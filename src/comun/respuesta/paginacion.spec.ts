import { paginar, respuestaLista, respuestaUno } from './respuesta.js';

describe('AGENTS §4.1 y §4.2 — sobre y paginación', () => {
  it('respuestaUno lleva meta en null', () => {
    expect(respuestaUno({ a: 1 })).toEqual({ datos: { a: 1 }, meta: null });
  });

  it('respuestaLista lleva total, pagina y porPagina', () => {
    expect(respuestaLista([1, 2], { total: 42, pagina: 2, porPagina: 2 })).toEqual({
      datos: [1, 2],
      meta: { total: 42, pagina: 2, porPagina: 2 },
    });
  });

  it.each([
    [undefined, undefined, { pagina: 1, porPagina: 20, skip: 0, take: 20 }],
    [3, 10, { pagina: 3, porPagina: 10, skip: 20, take: 10 }],
    [1, 100, { pagina: 1, porPagina: 100, skip: 0, take: 100 }],
  ])('paginar(%j, %j)', (pagina, porPagina, esperado) => {
    expect(paginar({ pagina, porPagina })).toEqual(esperado);
  });
});
