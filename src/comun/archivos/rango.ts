// Cabecera Range de HTTP (RFC 9110), lo que necesitan expo-audio y expo-video para
// adelantar y reproducir mientras descargan. Sólo un rango por pedido.
import type { RangoBytes } from './almacen-archivos.js';

/**
 * - sin cabecera (o no es de bytes) → null: se manda el archivo entero;
 * - rango válido → { inicio, fin } recortado al tamaño;
 * - rango imposible → 'insatisfacible' (416).
 */
export function leerRango(
  cabecera: string | undefined,
  total: number,
): RangoBytes | null | 'insatisfacible' {
  if (!cabecera) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim());
  if (!m) return null;
  const [, desde, hasta] = m;
  if (desde === '' && hasta === '') return null;
  if (total === 0) return 'insatisfacible';
  if (desde === '') {
    // "bytes=-500": los últimos 500.
    const sufijo = Number(hasta);
    if (sufijo === 0) return 'insatisfacible';
    return { inicio: Math.max(0, total - sufijo), fin: total - 1 };
  }
  const inicio = Number(desde);
  const fin = hasta === '' ? total - 1 : Math.min(Number(hasta), total - 1);
  if (inicio >= total || inicio > fin) return 'insatisfacible';
  return { inicio, fin };
}
