/** El favorito nuevo va al final: uno más que el mayor orden que ya hay (R16). */
export function siguienteOrden(existentes: number[]): number {
  return existentes.length === 0 ? 0 : Math.max(...existentes) + 1;
}
