// Número de seguimiento del reporte (R4): GCHU-<año>-<5 dígitos>, correlativo por año.

const PATRON = /^GCHU-(\d{4})-(\d{5})$/;

export const prefijoDelAnio = (anio: number): string => `GCHU-${anio}-`;

export const formatearCodigo = (anio: number, correlativo: number): string =>
  `${prefijoDelAnio(anio)}${String(correlativo).padStart(5, '0')}`;

/** El correlativo que sigue al último código del año (null si todavía no hay ninguno). */
export function correlativoSiguiente(ultimoCodigo: string | null): number {
  if (ultimoCodigo === null) return 1;
  const m = PATRON.exec(ultimoCodigo);
  return m ? Number(m[2]) + 1 : 1;
}

/** Un código escrito a mano o leído de un QR, sin espacios y en mayúsculas; null si no tiene la forma. */
export function normalizarCodigo(texto: string): string | null {
  const limpio = texto.trim().toUpperCase();
  return PATRON.test(limpio) ? limpio : null;
}
