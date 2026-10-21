/** Saca los repetidos sin alterar el orden en que se eligieron. */
export function sinRepetidos(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Los ids pedidos que no figuran entre los existentes. */
export function rubrosInexistentes(pedidos: string[], existentes: Iterable<string>): string[] {
  const conocidos = new Set(existentes);
  return pedidos.filter((id) => !conocidos.has(id));
}
