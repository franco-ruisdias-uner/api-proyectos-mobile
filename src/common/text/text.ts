/** Minúsculas, sin tildes y con los espacios colapsados: así se guarda y se busca (AGENTS §5.5). */
export function normalizarParaBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
