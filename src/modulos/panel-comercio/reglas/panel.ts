/** D11: catálogo fijo de medios de pago. */
export const MEDIOS_DE_PAGO = [
  'efectivo',
  'debito',
  'credito',
  'transferencia',
  'billetera_virtual',
] as const;

/** Sin repetidos, en el orden en que vinieron. */
export const sinRepetidos = <T>(lista: readonly T[]): T[] => [...new Set(lista)];

/**
 * R6: `hasta > desde` y `hasta > ahora`. Una que termina antes de empezar es un error de
 * carga (`orden`); una que ya terminó es `vencida`.
 */
export function ventanaDePromocion(
  desde: Date,
  hasta: Date,
  ahora: Date,
): 'ok' | 'orden' | 'vencida' {
  if (hasta.getTime() <= desde.getTime()) return 'orden';
  if (hasta.getTime() <= ahora.getTime()) return 'vencida';
  return 'ok';
}
