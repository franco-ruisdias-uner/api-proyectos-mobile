// R6: la grilla se puede pedir desde hoy hasta hoy + 6 ("los próximos siete días").
import { sumarDias } from '../../../comun/fechas/fechas.js';

export const DIAS_HACIA_ADELANTE = 6;

/** ¿`fecha` está entre `hoy` y `hoy` + 6? Ambos "AAAA-MM-DD" (se comparan como texto). */
export function fechaEnRango(fecha: string, hoy: string): boolean {
  return fecha >= hoy && fecha <= sumarDias(hoy, DIAS_HACIA_ADELANTE);
}
