import { paginar } from './pagination.js';

describe('AGENTS §4.2 — Paginación', () => {
  const todos = Array.from({ length: 45 }, (_, i) => i);

  it('la primera página trae porPagina elementos y el total', () => {
    expect(paginar(todos, { pagina: 1, porPagina: 20 })).toEqual({
      datos: todos.slice(0, 20),
      meta: { total: 45, pagina: 1, porPagina: 20 },
    });
  });

  it('la última página trae lo que queda', () => {
    expect(paginar(todos, { pagina: 3, porPagina: 20 }).datos).toEqual([
      40, 41, 42, 43, 44,
    ]);
  });

  it('una página fuera de rango devuelve datos vacíos con el total correcto', () => {
    expect(paginar(todos, { pagina: 9, porPagina: 20 })).toEqual({
      datos: [],
      meta: { total: 45, pagina: 9, porPagina: 20 },
    });
  });
});
