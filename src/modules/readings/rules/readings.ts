/** R14: `(valor − lecturaAnterior) × multiplicador`; sin anterior (conexión nueva), `valor × multiplicador` (D5). */
export function calcularConsumo(
  valor: number,
  lecturaAnterior: number | null,
  multiplicador: number,
): number {
  return (valor - (lecturaAnterior ?? 0)) * multiplicador;
}

const PISO_PROMEDIO = 5;
const REFERENCIA_SIN_PROMEDIO = 20;
const FACTOR_DE_RANGO = 3;

/** R16 (D4): fuera de rango si es negativo o supera 3 veces la referencia. Avisa, nunca bloquea. */
export function evaluarRango(
  consumo: number,
  consumoPromedio: number | null,
): boolean {
  if (consumo < 0) return true;
  const referencia =
    consumoPromedio === null
      ? REFERENCIA_SIN_PROMEDIO
      : Math.max(consumoPromedio, PISO_PROMEDIO);
  return consumo > FACTOR_DE_RANGO * referencia;
}

/** R12: entero entre 0 y 10^dígitos − 1. */
export function valorPosible(valor: number, digitos: number): boolean {
  return Number.isInteger(valor) && valor >= 0 && valor <= 10 ** digitos - 1;
}

export interface ResultadoDeSuministro {
  id: string;
  suministroId: string;
  fechaHora: Date;
}

/** Más reciente primero; si empatan, el de mayor id (orden determinístico). */
function masReciente<T extends ResultadoDeSuministro>(a: T, b: T): number {
  const dif = b.fechaHora.getTime() - a.fechaHora.getTime();
  if (dif !== 0) return dif;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * R13 (D7): el resultado vigente de un suministro. Si hay alguna lectura gana la lectura más
 * reciente; si no, la novedad más reciente. Se decide por `fechaHora`, no por orden de llegada.
 */
export function elegirVigente<
  L extends ResultadoDeSuministro,
  N extends ResultadoDeSuministro,
>(
  lecturas: L[],
  novedades: N[],
):
  { tipo: 'lectura'; resultado: L } | { tipo: 'novedad'; resultado: N } | null {
  if (lecturas.length > 0)
    return { tipo: 'lectura', resultado: [...lecturas].sort(masReciente)[0] };
  if (novedades.length > 0)
    return { tipo: 'novedad', resultado: [...novedades].sort(masReciente)[0] };
  return null;
}
