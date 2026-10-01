import type { Gravedad } from '../../../../contrato/tipos.js';

const PESO: Record<Gravedad, number> = { suspension: 0, desvio: 1, informativo: 2 };

/** Espec. §4: gravedad (suspensión, desvío, informativo), después `desde` descendente, después id. */
export function ordenarAvisos<T extends { id: string; gravedad: Gravedad; desde: Date }>(
  avisos: T[],
): T[] {
  return [...avisos].sort(
    (a, b) =>
      PESO[a.gravedad] - PESO[b.gravedad] ||
      b.desde.getTime() - a.desde.getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
