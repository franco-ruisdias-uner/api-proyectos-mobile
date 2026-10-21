const DIA_MS = 24 * 60 * 60 * 1000;

/** D4: "arranca pronto" es dentro de 7 días y "por vencer", dentro de 3. */
export const DIAS_PROXIMA = 7;
export const DIAS_POR_VENCER = 3;

export const ESTADOS_PROMOCIONES = ['vigentes', 'proximas', 'por-vencer'] as const;
export type EstadoPromociones = (typeof ESTADOS_PROMOCIONES)[number];

export interface PromocionEvaluable {
  id: string;
  activa: boolean;
  desde: Date;
  hasta: Date;
}

export type SituacionPromocion = 'baja' | 'vencida' | 'proxima' | 'vigente';

/** R4 y R5. Vigente: `activa` y `desde ≤ ahora ≤ hasta`. Una dada de baja no se muestra, venza o no. */
export function clasificarPromocion(p: PromocionEvaluable, ahora: Date): SituacionPromocion {
  if (!p.activa) return 'baja';
  if (p.hasta.getTime() < ahora.getTime()) return 'vencida';
  if (p.desde.getTime() > ahora.getTime()) return 'proxima';
  return 'vigente';
}

/** ¿Entra la promo en la lista de ese estado? Las "por vencer" también son vigentes. */
export function coincideConEstado(
  p: PromocionEvaluable,
  estado: EstadoPromociones,
  ahora: Date,
): boolean {
  const situacion = clasificarPromocion(p, ahora);
  if (estado === 'vigentes') return situacion === 'vigente';
  if (estado === 'por-vencer') {
    return (
      situacion === 'vigente' && p.hasta.getTime() <= ahora.getTime() + DIAS_POR_VENCER * DIA_MS
    );
  }
  return situacion === 'proxima' && p.desde.getTime() <= ahora.getTime() + DIAS_PROXIMA * DIA_MS;
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Próximas por `desde`; vigentes y por vencer por `hasta`. Siempre desempata por id. */
export function ordenarPromociones<T extends PromocionEvaluable>(
  lista: readonly T[],
  estado: EstadoPromociones,
): T[] {
  const instante = (p: T) => (estado === 'proximas' ? p.desde : p.hasta).getTime();
  return [...lista].sort((a, b) => instante(a) - instante(b) || comparar(a.id, b.id));
}

const ID_DE_PROMOCION = /^pro-[A-Za-z0-9_-]{3,36}$/;
export const esIdDePromocion = (id: string): boolean => ID_DE_PROMOCION.test(id);
