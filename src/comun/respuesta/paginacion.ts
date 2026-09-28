export const POR_PAGINA_DEFAULT = 20;
export const POR_PAGINA_MAXIMO = 100;

export interface Paginacion {
  pagina: number;
  porPagina: number;
  saltar: number;
}

export function calcularPaginacion(pedido: { pagina?: number; porPagina?: number }): Paginacion {
  const pagina = pedido.pagina ?? 1;
  const porPagina = pedido.porPagina ?? POR_PAGINA_DEFAULT;
  return { pagina, porPagina, saltar: (pagina - 1) * porPagina };
}
