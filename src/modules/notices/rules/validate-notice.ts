/** R11: `hasta`, si viene, tiene que ser posterior a `desde`. */
export function validarVentana(desde: Date, hasta: Date | null): boolean {
  return hasta === null || hasta.getTime() > desde.getTime();
}
