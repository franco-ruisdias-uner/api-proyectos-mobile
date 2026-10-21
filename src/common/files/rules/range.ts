export interface Rango {
  inicio: number;
  fin: number;
}

/**
 * Interpreta la cabecera Range (un solo rango de bytes).
 * - null: no hay cabecera o no se entiende → se manda el archivo entero (RFC 9110 §14.2).
 * - 'no-satisfacible': pide bytes fuera del archivo → 416.
 */
export function parsearRango(
  cabecera: string | undefined,
  bytesTotales: number,
): Rango | 'no-satisfacible' | null {
  if (!cabecera) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;

  if (m[1] === '') {
    // "bytes=-N": los últimos N bytes.
    const sufijo = Number(m[2]);
    if (sufijo === 0 || bytesTotales === 0) return 'no-satisfacible';
    return { inicio: Math.max(0, bytesTotales - sufijo), fin: bytesTotales - 1 };
  }

  const inicio = Number(m[1]);
  const fin = m[2] === '' ? Infinity : Number(m[2]);
  if (fin < inicio) return null;
  if (inicio >= bytesTotales) return 'no-satisfacible';
  return { inicio, fin: Math.min(fin, bytesTotales - 1) };
}
