export interface VentanaDeAviso {
  desde: Date;
  hasta: Date | null;
}

export type EstadoDeAviso = 'vigentes' | 'proximos' | 'todos';
export const ESTADOS_DE_AVISO: EstadoDeAviso[] = ['vigentes', 'proximos', 'todos'];

/** R10: `desde ≤ ahora` y (`hasta` es null o `hasta > ahora`). */
export function esVigente({ desde, hasta }: VentanaDeAviso, ahora: Date): boolean {
  return (
    desde.getTime() <= ahora.getTime() && (hasta === null || hasta.getTime() > ahora.getTime())
  );
}

/** R10: `desde > ahora`. */
export function esProximo({ desde }: VentanaDeAviso, ahora: Date): boolean {
  return desde.getTime() > ahora.getTime();
}

export function coincideConEstado(
  aviso: VentanaDeAviso,
  estado: EstadoDeAviso,
  ahora: Date,
): boolean {
  if (estado === 'todos') return true;
  return estado === 'vigentes' ? esVigente(aviso, ahora) : esProximo(aviso, ahora);
}

/**
 * `POST /avisos/:id/finalizar`: `hasta` = ahora. Si ya había terminado queda como estaba
 * (idempotente); si todavía no había empezado, también se adelanta `desde`, así queda
 * cancelado y nunca llega a ser vigente.
 */
export function ventanaAlFinalizar(aviso: VentanaDeAviso, ahora: Date): VentanaDeAviso {
  if (aviso.hasta !== null && aviso.hasta.getTime() <= ahora.getTime()) return aviso;
  return { desde: aviso.desde.getTime() > ahora.getTime() ? ahora : aviso.desde, hasta: ahora };
}
