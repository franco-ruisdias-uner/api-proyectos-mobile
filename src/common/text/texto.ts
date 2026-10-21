/**
 * Texto normalizado para las columnas de búsqueda (AGENTS §5.5): minúsculas, sin tildes y
 * con los espacios colapsados. Se aplica igual al guardar y al buscar.
 */
export function normalizarParaBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
