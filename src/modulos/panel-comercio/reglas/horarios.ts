import type { Horario } from '../../../../contrato/tipos.js';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const esHoraValida = (texto: string): boolean => HORA.test(texto);

/**
 * R2: cada tramo es `HH:MM` y abre antes de cerrar (no hay tramos que crucen la medianoche:
 * se cargan como dos tramos de días distintos). Devuelve el primer problema o `null`.
 */
export function horariosInvalidos(horarios: Horario[]): 'formato' | 'abre' | null {
  for (const t of horarios) {
    if (!esHoraValida(t.abre) || !esHoraValida(t.cierra)) return 'formato';
    if (t.abre >= t.cierra) return 'abre';
  }
  return null;
}

/** R2: dos tramos del mismo día se pisan si uno empieza antes de que termine el otro. */
export function horariosSuperpuestos(horarios: Horario[]): boolean {
  const porDia = new Map<number, Horario[]>();
  for (const t of horarios) porDia.set(t.dia, [...(porDia.get(t.dia) ?? []), t]);
  for (const tramos of porDia.values()) {
    const ordenados = [...tramos].sort((a, b) => (a.abre < b.abre ? -1 : a.abre > b.abre ? 1 : 0));
    for (let i = 1; i < ordenados.length; i++) {
      if (ordenados[i].abre < ordenados[i - 1].cierra) return true;
    }
  }
  return false;
}
