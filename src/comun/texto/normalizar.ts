/** Minúsculas, sin tildes y con espacios colapsados: lo que se guarda en `<campo>Busqueda`. */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
