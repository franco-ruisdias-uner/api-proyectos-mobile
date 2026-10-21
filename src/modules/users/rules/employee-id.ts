// R1: el legajo se guarda como lo escribieron y se compara sin distinguir mayúsculas.

export const LARGO_MAXIMO_LEGAJO = 20;

export function normalizarLegajo(legajo: string): string {
  return legajo.normalize('NFC').trim().toLocaleLowerCase('es-AR');
}

/** Orden de las listas de usuarios: por legajo (sin mayúsculas) y, si empata, por id. */
export function compararPorLegajo(
  a: { legajoBusqueda: string; id: string },
  b: { legajoBusqueda: string; id: string },
): number {
  if (a.legajoBusqueda !== b.legajoBusqueda) {
    return a.legajoBusqueda < b.legajoBusqueda ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
