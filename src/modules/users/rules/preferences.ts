import type { Preferencias } from '../../../../contract/types.js';

export const RADIOS_AVISO = [100, 250, 500] as const;
export const TEMAS = ['claro', 'oscuro', 'sistema'] as const;

/** Preferencias con las que arranca toda cuenta nueva (especificación §1). */
export function preferenciasIniciales(): Preferencias {
  return { categoriasFavoritas: [], avisarProximidad: true, radioAvisoMetros: 250, tema: 'sistema' };
}

/**
 * R18: `preferencias` se mezcla campo a campo; no hace falta mandarla entera.
 * Las categorías repetidas se guardan una sola vez, en el orden en que llegaron.
 */
export function mezclarPreferencias(actuales: Preferencias, cambios: Partial<Preferencias>): Preferencias {
  const categorias = cambios.categoriasFavoritas ?? actuales.categoriasFavoritas;
  return {
    categoriasFavoritas: [...new Set(categorias)],
    avisarProximidad: cambios.avisarProximidad ?? actuales.avisarProximidad,
    radioAvisoMetros: cambios.radioAvisoMetros ?? actuales.radioAvisoMetros,
    tema: cambios.tema ?? actuales.tema,
  };
}
