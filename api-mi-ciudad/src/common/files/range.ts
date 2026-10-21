import type { RangoBytes } from './file-storage.js';

/**
 * Interpreta la cabecera `Range` para un archivo de `total` bytes.
 * - `undefined`: no hay rango (o pide varios, que no se soportan): se manda entero.
 * - `'insatisfacible'`: el rango cae fuera del archivo (416).
 */
export function leerRango(
  cabecera: string | undefined,
  total: number,
): RangoBytes | 'insatisfacible' | undefined {
  if (!cabecera) return undefined;
  const partes = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!partes) return undefined;
  const [, desde, hasta] = partes;
  if (desde === '' && hasta === '') return undefined;
  let inicio: number;
  let fin: number;
  if (desde === '') {
    // bytes=-N: los últimos N bytes
    const n = Number(hasta);
    if (n === 0) return 'insatisfacible';
    inicio = Math.max(0, total - n);
    fin = total - 1;
  } else {
    inicio = Number(desde);
    fin = hasta === '' ? total - 1 : Math.min(Number(hasta), total - 1);
  }
  if (inicio >= total || inicio > fin) return 'insatisfacible';
  return { inicio, fin };
}
