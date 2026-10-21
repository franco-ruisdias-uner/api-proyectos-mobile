/** Minúsculas, sin tildes, espacios colapsados: "  Colón  " → "colon". */
export function normalizarParaBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
