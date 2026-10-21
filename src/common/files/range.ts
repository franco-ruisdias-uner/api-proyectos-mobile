// Cabecera Range: sólo un rango de bytes (lo que piden expo-audio y expo-video).

export interface Rango {
  inicio: number;
  fin: number; // inclusive
}

/**
 * 'entero' si no hay rango usable (sin cabecera, varios rangos o algo que no se entiende:
 * se manda el archivo completo, como permite RFC 9110); 'insatisfacible' si pide algo fuera
 * del archivo (416).
 */
export function parsearRango(
  cabecera: string | undefined,
  total: number,
): Rango | 'entero' | 'insatisfacible' {
  if (!cabecera) return 'entero';
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'entero';

  if (m[1] === '') {
    const sufijo = Number(m[2]);
    if (sufijo === 0 || total === 0) return 'insatisfacible';
    return { inicio: Math.max(0, total - sufijo), fin: total - 1 };
  }

  const inicio = Number(m[1]);
  const fin = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  if (inicio >= total || (m[2] !== '' && Number(m[2]) < inicio))
    return 'insatisfacible';
  return { inicio, fin };
}
